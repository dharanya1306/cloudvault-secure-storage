import express from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// AES-256-GCM 32-byte (256-bit) Master Key
const AES_SECRET_KEY = crypto.scryptSync('CloudVault-Master-Key-AES-256-GCM-2026', 'cloudvault_salt', 32);

// Multer memory storage configured with 50MB file size limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

// ===================================================================
// IN-MEMORY PERSISTENCE LAYER (Mirrors MySQL + S3)
// ===================================================================
interface UserRecord {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  role: 'ROLE_USER' | 'ROLE_ADMIN';
  storageQuotaBytes: number;
  usedStorageBytes: number;
  createdAt: string;
}

interface FileRecord {
  id: number;
  ownerId: number;
  originalFilename: string;
  s3ObjectKey: string;
  s3Bucket: string;
  fileSizeBytes: number;
  mimeType: string;
  encryptionAlgorithm: string;
  checksumSha256: string;
  isDeleted: boolean;
  createdAt: string;
  encryptedBytes: Buffer; // Simulated S3 Encrypted Blob
}

interface ShareRecord {
  id: number;
  fileId: number;
  sharedByUserId: number;
  sharedWithEmail: string | null;
  shareToken: string;
  accessPermission: 'VIEW' | 'DOWNLOAD';
  expiresAt: string;
  createdAt: string;
}

interface AuditRecord {
  id: number;
  userId: number | null;
  actionType: 'LOGIN' | 'LOGOUT' | 'UPLOAD' | 'DOWNLOAD' | 'DELETE' | 'SHARE_CREATED' | 'ACCESS_DENIED';
  fileId: number | null;
  ipAddress: string;
  details: string;
  createdAt: string;
}

// Initial Seed User (Alex Architect)
const initialPasswordHash = crypto.createHash('sha256').update('Vault@Security2026!').digest('hex');

const db = {
  users: [
    {
      id: 1,
      username: 'alex.architect',
      email: 'alex.architect@cloudvault.internal',
      passwordHash: initialPasswordHash,
      role: 'ROLE_USER' as const,
      storageQuotaBytes: 1073741824, // 1 GB
      usedStorageBytes: 0,
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString()
    }
  ] as UserRecord[],
  files: [] as FileRecord[],
  shares: [] as ShareRecord[],
  auditLogs: [] as AuditRecord[]
};

// Seed initial files for demonstration of AES-256-GCM encryption
function seedSampleFiles() {
  const sample1 = Buffer.from(
    `# CLOUDVAULT SECURITY CLEARANCE - TOP SECRET\n` +
    `Encryption standard: AES/GCM/NoPadding (256-bit)\n` +
    `Classification: CONFIDENTIAL DATA ASSET\n` +
    `Owner: Alex Architect\n` +
    `Timestamp: 2026-11-02\n` +
    `Integrity: Verified with SHA-256 Checksum\n`,
    'utf-8'
  );

  const sample2 = Buffer.from(
    `// Spring Boot 3 & AWS SDK v2 Integration Guide\n` +
    `@Configuration\n` +
    `public class CloudVaultSecurityConfig {\n` +
    `    // Enforces zero-knowledge AES-256-GCM symmetric encryption\n` +
    `}\n`,
    'utf-8'
  );

  encryptAndPersistSample(1, 'Security_Architecture_Brief.md', 'text/markdown', sample1);
  encryptAndPersistSample(1, 'Spring_Security_Config.java', 'text/plain', sample2);
}

function encryptAndPersistSample(userId: number, filename: string, mimeType: string, plaintext: Buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_SECRET_KEY, iv);
  const encryptedBody = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combined [12-byte IV] + [Ciphertext] + [16-byte Auth Tag]
  const combined = Buffer.concat([iv, encryptedBody, authTag]);
  const sha256 = crypto.createHash('sha256').update(plaintext).digest('hex');

  const fileId = db.files.length + 1;
  const s3Key = `vault/${userId}/${crypto.randomUUID()}_${filename}.enc`;

  const record: FileRecord = {
    id: fileId,
    ownerId: userId,
    originalFilename: filename,
    s3ObjectKey: s3Key,
    s3Bucket: 'cloudvault-secure-storage-prod',
    fileSizeBytes: plaintext.length,
    mimeType,
    encryptionAlgorithm: 'AES-256-GCM',
    checksumSha256: sha256,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    encryptedBytes: combined
  };

  db.files.push(record);
  const user = db.users.find(u => u.id === userId);
  if (user) {
    user.usedStorageBytes += plaintext.length;
  }

  db.auditLogs.unshift({
    id: db.auditLogs.length + 1,
    userId,
    actionType: 'UPLOAD',
    fileId,
    ipAddress: '127.0.0.1',
    details: `Encrypted & stored file '${filename}' (${plaintext.length} bytes, SHA-256: ${sha256.substring(0, 8)}...)`,
    createdAt: new Date().toISOString()
  });
}

seedSampleFiles();

// Helper to log audit
function addAudit(userId: number | null, actionType: AuditRecord['actionType'], fileId: number | null, ip: string, details: string) {
  db.auditLogs.unshift({
    id: db.auditLogs.length + 1,
    userId,
    actionType,
    fileId,
    ipAddress: ip || '127.0.0.1',
    details,
    createdAt: new Date().toISOString()
  });
}

// Token helper
function extractUserFromHeader(req: express.Request): UserRecord | null {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.substring(7);

  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    const user = db.users.find(u => u.id === decoded.userId);
    return user || null;
  } catch {
    return null;
  }
}

function generateToken(user: UserRecord): string {
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    exp: Date.now() + 86400000 // 24 hours
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

// ===================================================================
// REST API ENDPOINTS (Spring Boot 3 Contract)
// ===================================================================

// 1. POST /api/auth/register
app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body;
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

  if (!username || !email || !password) {
    return res.status(400).json({ status: 400, error: 'Bad Request', message: 'All registration fields are required' });
  }

  if (db.users.some(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
    return res.status(400).json({ status: 400, error: 'Bad Request', message: `Username '${username}' is already taken` });
  }

  if (db.users.some(u => u.email.toLowerCase() === email.trim().toLowerCase())) {
    return res.status(400).json({ status: 400, error: 'Bad Request', message: `Email '${email}' is already registered` });
  }

  const hash = crypto.createHash('sha256').update(password).digest('hex');
  const newUser: UserRecord = {
    id: db.users.length + 1,
    username: username.trim(),
    email: email.trim().toLowerCase(),
    passwordHash: hash,
    role: 'ROLE_USER',
    storageQuotaBytes: 1073741824, // 1 GB
    usedStorageBytes: 0,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  addAudit(newUser.id, 'LOGIN', null, clientIp, 'User account created and auto-authenticated');

  const token = generateToken(newUser);
  res.status(201).json({
    token,
    tokenType: 'Bearer',
    expiresInMs: 86400000,
    userId: newUser.id,
    username: newUser.username,
    email: newUser.email,
    role: newUser.role,
    storageQuotaBytes: newUser.storageQuotaBytes,
    usedStorageBytes: newUser.usedStorageBytes
  });
});

// 2. POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

  if (!username || !password) {
    return res.status(400).json({ status: 400, error: 'Bad Request', message: 'Username and password are required' });
  }

  const user = db.users.find(u =>
    u.username.toLowerCase() === username.trim().toLowerCase() ||
    u.email.toLowerCase() === username.trim().toLowerCase()
  );

  const hash = crypto.createHash('sha256').update(password).digest('hex');

  if (!user || user.passwordHash !== hash) {
    addAudit(user ? user.id : null, 'ACCESS_DENIED', null, clientIp, `Failed authentication for '${username}'`);
    return res.status(401).json({ status: 401, error: 'Unauthorized', message: 'Invalid username or password' });
  }

  addAudit(user.id, 'LOGIN', null, clientIp, 'User successfully authenticated');
  const token = generateToken(user);

  res.json({
    token,
    tokenType: 'Bearer',
    expiresInMs: 86400000,
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    storageQuotaBytes: user.storageQuotaBytes,
    usedStorageBytes: user.usedStorageBytes
  });
});

// 3. GET /api/files/my-files
app.get('/api/files/my-files', (req, res) => {
  const user = extractUserFromHeader(req);
  if (!user) return res.status(401).json({ status: 401, error: 'Unauthorized' });

  const activeFiles = db.files
    .filter(f => f.ownerId === user.id && !f.isDeleted)
    .map(f => ({
      id: f.id,
      originalFilename: f.originalFilename,
      s3ObjectKey: f.s3ObjectKey,
      fileSizeBytes: f.fileSizeBytes,
      mimeType: f.mimeType,
      encryptionAlgorithm: f.encryptionAlgorithm,
      checksumSha256: f.checksumSha256,
      createdAt: f.createdAt,
      ownerUsername: user.username
    }))
    .reverse();

  res.json(activeFiles);
});

// 4. POST /api/files/upload
app.post('/api/files/upload', upload.single('file'), (req, res) => {
  const user = extractUserFromHeader(req);
  if (!user) return res.status(401).json({ status: 401, error: 'Unauthorized' });

  const file = req.file;
  if (!file) return res.status(400).json({ status: 400, error: 'Bad Request', message: 'No file uploaded' });

  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const fileSize = file.size;
  const projected = user.usedStorageBytes + fileSize;

  // Quota enforcement
  if (projected > user.storageQuotaBytes) {
    addAudit(user.id, 'UPLOAD', null, clientIp, `Upload rejected: storage quota exceeded for '${file.originalname}'`);
    return res.status(413).json({
      status: 413,
      error: 'Storage Quota Exceeded',
      message: `Storage quota exceeded! Maximum allowed quota is ${(user.storageQuotaBytes / (1024 * 1024)).toFixed(0)} MB`
    });
  }

  // 1. Calculate SHA-256 on plaintext
  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');

  // 2. Encrypt with AES/GCM/NoPadding (256-bit key, 128-bit auth tag, 12-byte IV)
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_SECRET_KEY, iv);
  const encryptedPayload = Buffer.concat([cipher.update(file.buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine [12-byte IV] + [Ciphertext] + [16-byte Auth Tag]
  const combined = Buffer.concat([iv, encryptedPayload, authTag]);

  // 3. Save to simulated S3 & DB
  const fileId = db.files.length + 1;
  const s3Key = `vault/${user.id}/${crypto.randomUUID()}_${file.originalname}.enc`;

  const newFile: FileRecord = {
    id: fileId,
    ownerId: user.id,
    originalFilename: file.originalname,
    s3ObjectKey: s3Key,
    s3Bucket: 'cloudvault-secure-storage-prod',
    fileSizeBytes: fileSize,
    mimeType: file.mimetype || 'application/octet-stream',
    encryptionAlgorithm: 'AES-256-GCM',
    checksumSha256: sha256,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    encryptedBytes: combined
  };

  db.files.push(newFile);
  user.usedStorageBytes = projected;

  addAudit(user.id, 'UPLOAD', fileId, clientIp, `Uploaded & encrypted '${file.originalname}' (${fileSize} bytes)`);

  res.status(201).json({
    id: newFile.id,
    originalFilename: newFile.originalFilename,
    s3ObjectKey: newFile.s3ObjectKey,
    fileSizeBytes: newFile.fileSizeBytes,
    mimeType: newFile.mimeType,
    encryptionAlgorithm: newFile.encryptionAlgorithm,
    checksumSha256: newFile.checksumSha256,
    createdAt: newFile.createdAt,
    ownerUsername: user.username
  });
});

// 5. GET /api/files/download/:id
app.get('/api/files/download/:id', (req, res) => {
  const user = extractUserFromHeader(req);
  if (!user) return res.status(401).json({ status: 401, error: 'Unauthorized' });

  const fileId = parseInt(req.params.id, 10);
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

  const file = db.files.find(f => f.id === fileId && !f.isDeleted);
  if (!file) {
    return res.status(404).json({ status: 404, error: 'Not Found', message: 'File not found' });
  }

  // Validate ownership or admin
  if (file.ownerId !== user.id && user.role !== 'ROLE_ADMIN') {
    addAudit(user.id, 'ACCESS_DENIED', fileId, clientIp, `Unauthorized download attempt for file ID ${fileId}`);
    return res.status(403).json({ status: 403, error: 'Forbidden', message: 'Access denied' });
  }

  try {
    // Combined payload: [12-byte IV] + [Ciphertext] + [16-byte Auth Tag]
    const combined = file.encryptedBytes;
    const iv = combined.subarray(0, 12);
    const authTag = combined.subarray(combined.length - 16);
    const ciphertext = combined.subarray(12, combined.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', AES_SECRET_KEY, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    addAudit(user.id, 'DOWNLOAD', file.id, clientIp, `Decrypted & downloaded '${file.originalFilename}'`);

    const encodedFilename = encodeURIComponent(file.originalFilename);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalFilename}"; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Content-Length', decrypted.length);
    res.setHeader('X-Checksum-SHA256', file.checksumSha256);

    res.send(decrypted);
  } catch (err: any) {
    res.status(500).json({ status: 500, error: 'Decryption Error', message: 'Cryptographic authentication tag mismatch or corrupted file' });
  }
});

// 6. DELETE /api/files/:id
app.delete('/api/files/:id', (req, res) => {
  const user = extractUserFromHeader(req);
  if (!user) return res.status(401).json({ status: 401, error: 'Unauthorized' });

  const fileId = parseInt(req.params.id, 10);
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

  const file = db.files.find(f => f.id === fileId && !f.isDeleted);
  if (!file) return res.status(404).json({ status: 404, error: 'Not Found', message: 'File not found' });

  if (file.ownerId !== user.id && user.role !== 'ROLE_ADMIN') {
    return res.status(403).json({ status: 403, error: 'Forbidden' });
  }

  file.isDeleted = true;
  user.usedStorageBytes = Math.max(0, user.usedStorageBytes - file.fileSizeBytes);

  addAudit(user.id, 'DELETE', file.id, clientIp, `Deleted '${file.originalFilename}' (${file.fileSizeBytes} bytes reclaimed)`);

  res.json({
    success: true,
    message: 'File successfully deleted and storage reclaimed',
    fileId
  });
});

// 7. GET /api/files/stats
app.get('/api/files/stats', (req, res) => {
  const user = extractUserFromHeader(req);
  if (!user) return res.status(401).json({ status: 401, error: 'Unauthorized' });

  const userFiles = db.files.filter(f => f.ownerId === user.id && !f.isDeleted);
  const totalUsed = userFiles.reduce((acc, f) => acc + f.fileSizeBytes, 0);
  user.usedStorageBytes = totalUsed;

  const quota = user.storageQuotaBytes;
  const available = Math.max(0, quota - totalUsed);
  const percentage = quota > 0 ? (totalUsed / quota) * 100 : 0;

  res.json({
    storageQuotaBytes: quota,
    usedStorageBytes: totalUsed,
    availableStorageBytes: available,
    usagePercentage: Math.round(percentage * 100) / 100,
    totalFiles: userFiles.length,
    encryptedFiles: userFiles.length
  });
});

// 8. POST /api/files/share
app.post('/api/files/share', (req, res) => {
  const user = extractUserFromHeader(req);
  if (!user) return res.status(401).json({ status: 401, error: 'Unauthorized' });

  const { fileId, sharedWithEmail, expiryHours, permission } = req.body;
  const file = db.files.find(f => f.id === fileId && !f.isDeleted);
  if (!file) return res.status(404).json({ status: 404, error: 'Not Found', message: 'File not found' });

  if (file.ownerId !== user.id) {
    return res.status(403).json({ status: 403, error: 'Forbidden' });
  }

  const hours = parseInt(expiryHours || '24', 10);
  const token = crypto.randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + hours * 3600000).toISOString();

  const share: ShareRecord = {
    id: db.shares.length + 1,
    fileId,
    sharedByUserId: user.id,
    sharedWithEmail: sharedWithEmail || null,
    shareToken: token,
    accessPermission: permission === 'VIEW' ? 'VIEW' : 'DOWNLOAD',
    expiresAt,
    createdAt: new Date().toISOString()
  };

  db.shares.push(share);
  addAudit(user.id, 'SHARE_CREATED', fileId, req.ip || '127.0.0.1', `Created share token (${hours}h expiry) for '${file.originalFilename}'`);

  res.status(201).json({
    id: share.id,
    fileId,
    filename: file.originalFilename,
    shareToken: token,
    sharedWithEmail: share.sharedWithEmail,
    permission: share.accessPermission,
    expiresAt: share.expiresAt,
    createdAt: share.createdAt
  });
});

// 9. GET /api/public/share/:token
app.get('/api/public/share/:token', (req, res) => {
  const { token } = req.params;
  const share = db.shares.find(s => s.shareToken === token);

  if (!share) {
    return res.status(404).json({ status: 404, error: 'Not Found', message: 'Share link is invalid or has expired' });
  }

  if (new Date(share.expiresAt) < new Date()) {
    return res.status(410).json({ status: 410, error: 'Gone', message: 'Share link expired' });
  }

  const file = db.files.find(f => f.id === share.fileId && !f.isDeleted);
  if (!file) {
    return res.status(404).json({ status: 404, error: 'Not Found', message: 'File is no longer available' });
  }

  try {
    const combined = file.encryptedBytes;
    const iv = combined.subarray(0, 12);
    const authTag = combined.subarray(combined.length - 16);
    const ciphertext = combined.subarray(12, combined.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', AES_SECRET_KEY, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    addAudit(share.sharedByUserId, 'DOWNLOAD', file.id, req.ip || '127.0.0.1', `Shared file '${file.originalFilename}' accessed via token`);

    const encodedFilename = encodeURIComponent(file.originalFilename);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalFilename}"; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Content-Length', decrypted.length);
    res.setHeader('X-Checksum-SHA256', file.checksumSha256);

    res.send(decrypted);
  } catch (err: any) {
    res.status(500).json({ status: 500, error: 'Decryption Error' });
  }
});

// 10. GET /api/audit-logs
app.get('/api/audit-logs', (req, res) => {
  const user = extractUserFromHeader(req);
  if (!user) return res.status(401).json({ status: 401, error: 'Unauthorized' });

  const logs = user.role === 'ROLE_ADMIN'
    ? db.auditLogs
    : db.auditLogs.filter(l => l.userId === user.id);

  res.json(logs);
});

// 11. GET /api/architecture/file?name=...
// Serves Spring Boot 3 Java source files to the in-app code explorer
app.get('/api/architecture/file', (req, res) => {
  const fileName = (req.query.name as string) || 'application.properties';
  const basePath = path.join(__dirname, 'backend-java-springboot');

  // Find file recursively
  function findFile(dir: string, targetName: string): string | null {
    if (!fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findFile(fullPath, targetName);
        if (found) return found;
      } else if (entry.name === targetName) {
        return fullPath;
      }
    }
    return null;
  }

  const filePath = findFile(basePath, fileName);
  if (filePath && fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  } else {
    res.status(404).send(`// File ${fileName} not found on disk.`);
  }
});

// ===================================================================
// VITE MIDDLEWARE SETUP (Express + Vite Dev Mode)
// ===================================================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CloudVault server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
