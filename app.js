/**
 * CloudVault – Secure Cloud File Storage and Access Management System
 * Vanilla JavaScript (ES6+ with Fetch API) Web Client
 */

// ===================================================================
// APPLICATION STATE
// ===================================================================
const AppState = {
  token: localStorage.getItem('cv_token') || null,
  user: JSON.parse(localStorage.getItem('cv_user') || 'null'),
  files: [],
  sharedLinks: JSON.parse(localStorage.getItem('cv_shares') || '[]'),
  auditLogs: [],
  stats: {
    storageQuotaBytes: 1073741824, // 1 GB
    usedStorageBytes: 0,
    availableStorageBytes: 1073741824,
    usagePercentage: 0,
    totalFiles: 0,
    encryptedFiles: 0
  },
  currentView: 'files-view',
  searchQuery: '',
  activeJavaFile: 'application.properties',
  currentPublicToken: null,
  pendingDeleteFileId: null,
  javaSources: {}
};

// API Base URL (relative path works for both Vite dev and full-stack Express)
const API_BASE = '/api';

// ===================================================================
// DOM ELEMENTS REFERENCE
// ===================================================================
const DOM = {
  // Screens
  authScreen: document.getElementById('auth-screen'),
  dashboardScreen: document.getElementById('dashboard-screen'),

  // Auth Tabs & Forms
  tabLogin: document.getElementById('tab-login'),
  tabRegister: document.getElementById('tab-register'),
  loginForm: document.getElementById('login-form'),
  registerForm: document.getElementById('register-form'),
  loginUsername: document.getElementById('login-username'),
  loginPassword: document.getElementById('login-password'),
  regUsername: document.getElementById('reg-username'),
  regEmail: document.getElementById('reg-email'),
  regPassword: document.getElementById('reg-password'),
  btnFillDemo: document.getElementById('btn-fill-demo'),

  // Dashboard Nav & User
  navItems: document.querySelectorAll('.nav-item'),
  badgeFileCount: document.getElementById('badge-file-count'),
  badgeShareCount: document.getElementById('badge-share-count'),
  userDisplayName: document.getElementById('user-display-name'),
  userRoleBadge: document.getElementById('user-role-badge'),
  userAvatarInitials: document.getElementById('user-avatar-initials'),
  btnLogout: document.getElementById('btn-logout'),

  // Quota & Header Stats
  quotaPercentText: document.getElementById('quota-percent-text'),
  quotaProgressFill: document.getElementById('quota-progress-fill'),
  quotaUsedText: document.getElementById('quota-used-text'),
  statTotalFiles: document.getElementById('stat-total-files'),
  statEncryptedFiles: document.getElementById('stat-encrypted-files'),
  fileSearchInput: document.getElementById('file-search-input'),
  btnClearSearch: document.getElementById('btn-clear-search'),
  btnQuickUpload: document.getElementById('btn-quick-upload-trigger'),

  // Dropzone & Explorer
  uploadDropzone: document.getElementById('upload-dropzone'),
  filePickerInput: document.getElementById('file-picker-input'),
  uploadProgressBox: document.getElementById('upload-progress-box'),
  uploadingFilename: document.getElementById('uploading-filename'),
  uploadingStatusLabel: document.getElementById('uploading-status-label'),
  uploadPercentage: document.getElementById('upload-percentage'),
  uploadProgressBar: document.getElementById('upload-progress-bar'),
  filesTable: document.getElementById('files-table'),
  filesTbody: document.getElementById('files-tbody'),
  filesEmptyState: document.getElementById('files-empty-state'),
  btnRefreshFiles: document.getElementById('btn-refresh-files'),

  // Shares View
  sharesTbody: document.getElementById('shares-tbody'),
  sharesEmptyState: document.getElementById('shares-empty-state'),

  // Audit Logs View
  auditTbody: document.getElementById('audit-tbody'),
  btnRefreshAudit: document.getElementById('btn-refresh-audit'),

  // Java Architecture Explorer
  treeItems: document.querySelectorAll('.tree-item'),
  viewerFilename: document.getElementById('viewer-filename'),
  codeDisplay: document.getElementById('code-display'),
  btnCopyJavaCode: document.getElementById('btn-copy-java-code'),

  // Modals
  shareModal: document.getElementById('share-modal'),
  shareForm: document.getElementById('share-form'),
  modalShareFileId: document.getElementById('modal-share-file-id'),
  modalShareFilename: document.getElementById('modal-share-filename'),
  shareRecipientEmail: document.getElementById('share-recipient-email'),
  shareResultBox: document.getElementById('share-result-box'),
  shareUrlOutput: document.getElementById('share-url-output'),
  btnCopyShareUrl: document.getElementById('btn-copy-share-url'),
  btnTestShareLink: document.getElementById('btn-test-share-link'),
  btnCloseShareModal: document.getElementById('btn-close-share-modal'),

  publicShareModal: document.getElementById('public-share-modal'),
  pubFilename: document.getElementById('pub-filename'),
  pubMeta: document.getElementById('pub-meta'),
  btnPublicDownload: document.getElementById('btn-public-download'),
  btnClosePublicModal: document.getElementById('btn-close-public-modal'),

  deleteModal: document.getElementById('delete-modal'),
  deleteFilenameTarget: document.getElementById('delete-filename-target'),
  btnCancelDelete: document.getElementById('btn-cancel-delete'),
  btnConfirmDelete: document.getElementById('btn-confirm-delete'),
  btnCloseDeleteModal: document.getElementById('btn-close-delete-modal'),

  toastContainer: document.getElementById('toast-container')
};

// ===================================================================
// UTILITY FUNCTIONS
// ===================================================================
function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatDate(isoString) {
  if (!isoString) return '--';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-emerald" style="color:var(--accent-emerald)"><polyline points="20 6 9 17 4 12"/></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accent-rose)"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  } else {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accent-cyan)"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  }

  toast.innerHTML = `
    ${iconSvg}
    <div class="toast-message">${escapeHtml(message)}</div>
  `;

  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function apiFetch(endpoint, options = {}) {
  const headers = options.headers || {};
  if (AppState.token) {
    headers['Authorization'] = `Bearer ${AppState.token}`;
  }

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers
    });

    if (response.status === 401) {
      handleUnauthorized();
      throw new Error('Session expired. Please sign in again.');
    }

    return response;
  } catch (err) {
    console.error('API Fetch Error:', err);
    throw err;
  }
}

function handleUnauthorized() {
  AppState.token = null;
  AppState.user = null;
  localStorage.removeItem('cv_token');
  localStorage.removeItem('cv_user');
  updateAppView();
}

// ===================================================================
// AUTHENTICATION CONTROLLER
// ===================================================================
function initAuth() {
  // Tab Switching
  DOM.tabLogin.addEventListener('click', () => {
    DOM.tabLogin.classList.add('active');
    DOM.tabLogin.setAttribute('aria-selected', 'true');
    DOM.tabRegister.classList.remove('active');
    DOM.tabRegister.setAttribute('aria-selected', 'false');
    DOM.loginForm.classList.remove('hidden');
    DOM.registerForm.classList.add('hidden');
  });

  DOM.tabRegister.addEventListener('click', () => {
    DOM.tabRegister.classList.add('active');
    DOM.tabRegister.setAttribute('aria-selected', 'true');
    DOM.tabLogin.classList.remove('active');
    DOM.tabLogin.setAttribute('aria-selected', 'false');
    DOM.registerForm.classList.remove('hidden');
    DOM.loginForm.classList.add('hidden');
  });

  // Load Demo Credentials
  DOM.btnFillDemo.addEventListener('click', () => {
    DOM.loginUsername.value = 'alex.architect';
    DOM.loginPassword.value = 'Vault@Security2026!';
    showToast('Loaded demo credentials for Alex Architect', 'info');
  });

  // Login Submit
  DOM.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = DOM.loginUsername.value.trim();
    const password = DOM.loginPassword.value;

    const submitBtn = document.getElementById('btn-login-submit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Verifying AES credentials...</span>';

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Invalid username or password');
      }

      const data = await res.json();
      setAuthenticatedUser(data);
      showToast(`Welcome back, ${data.username}! Vault unlocked.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <span>Sign In to Vault</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      `;
    }
  });

  // Register Submit
  DOM.registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = DOM.regUsername.value.trim();
    const email = DOM.regEmail.value.trim();
    const password = DOM.regPassword.value;

    const submitBtn = document.getElementById('btn-reg-submit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Generating Encryption Vault...</span>';

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Registration failed');
      }

      const data = await res.json();
      setAuthenticatedUser(data);
      showToast('Vault provisioned with 1.0 GB dedicated storage!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <span>Create Encrypted Vault</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      `;
    }
  });

  // Logout
  DOM.btnLogout.addEventListener('click', () => {
    AppState.token = null;
    AppState.user = null;
    localStorage.removeItem('cv_token');
    localStorage.removeItem('cv_user');
    updateAppView();
    showToast('Vault locked and session cleared', 'info');
  });
}

function setAuthenticatedUser(authResponse) {
  AppState.token = authResponse.token;
  AppState.user = {
    userId: authResponse.userId,
    username: authResponse.username,
    email: authResponse.email,
    role: authResponse.role,
    storageQuotaBytes: authResponse.storageQuotaBytes || 1073741824,
    usedStorageBytes: authResponse.usedStorageBytes || 0
  };

  localStorage.setItem('cv_token', AppState.token);
  localStorage.setItem('cv_user', JSON.stringify(AppState.user));

  updateAppView();
  fetchStorageStats();
  fetchFiles();
  fetchAuditLogs();
}

function updateAppView() {
  if (AppState.token && AppState.user) {
    DOM.authScreen.classList.add('hidden');
    DOM.dashboardScreen.classList.remove('hidden');

    DOM.userDisplayName.textContent = AppState.user.username;
    DOM.userRoleBadge.textContent = AppState.user.role || 'ROLE_USER';
    DOM.userAvatarInitials.textContent = (AppState.user.username || 'U').substring(0, 2).toUpperCase();

    updateQuotaDisplay();
  } else {
    DOM.authScreen.classList.remove('hidden');
    DOM.dashboardScreen.classList.add('hidden');
  }
}

// ===================================================================
// STORAGE STATS & QUOTA MANAGEMENT
// ===================================================================
async function fetchStorageStats() {
  if (!AppState.token) return;

  try {
    const res = await apiFetch(`${API_BASE}/files/stats`);
    if (res.ok) {
      AppState.stats = await res.json();
      updateQuotaDisplay();
    }
  } catch (err) {
    console.warn('Could not fetch storage stats:', err);
  }
}

function updateQuotaDisplay() {
  const quota = AppState.stats.storageQuotaBytes || 1073741824;
  const used = AppState.stats.usedStorageBytes || 0;
  const percent = Math.min(100, Math.round((used / quota) * 100));

  DOM.quotaPercentText.textContent = `${percent}%`;
  DOM.quotaProgressFill.style.width = `${percent}%`;
  DOM.quotaUsedText.textContent = formatBytes(used);

  DOM.statTotalFiles.textContent = AppState.stats.totalFiles || AppState.files.length || 0;
  DOM.statEncryptedFiles.textContent = AppState.stats.encryptedFiles || AppState.files.length || 0;
  DOM.badgeFileCount.textContent = AppState.files.length || 0;
  DOM.badgeShareCount.textContent = AppState.sharedLinks.length || 0;

  if (percent > 90) {
    DOM.quotaProgressFill.style.background = 'var(--accent-rose)';
  } else {
    DOM.quotaProgressFill.style.background = 'linear-gradient(90deg, var(--accent-primary), var(--accent-cyan))';
  }
}

// ===================================================================
// FILE MANAGEMENT & ENCRYPTION PIPELINE
// ===================================================================
async function fetchFiles() {
  if (!AppState.token) return;

  try {
    const res = await apiFetch(`${API_BASE}/files/my-files`);
    if (res.ok) {
      AppState.files = await res.json();
      renderFilesTable();
      updateQuotaDisplay();
    }
  } catch (err) {
    showToast('Failed to load files from storage vault', 'error');
  }
}

function renderFilesTable() {
  DOM.filesTbody.innerHTML = '';

  const query = (AppState.searchQuery || '').toLowerCase().trim();
  const filtered = AppState.files.filter(f => {
    if (!query) return true;
    return (f.originalFilename || '').toLowerCase().includes(query) ||
           (f.mimeType || '').toLowerCase().includes(query) ||
           (f.checksumSha256 || '').toLowerCase().includes(query);
  });

  if (filtered.length === 0) {
    DOM.filesEmptyState.classList.remove('hidden');
    DOM.filesTable.classList.add('hidden');
    return;
  }

  DOM.filesEmptyState.classList.add('hidden');
  DOM.filesTable.classList.remove('hidden');

  filtered.forEach(file => {
    const tr = document.createElement('tr');
    tr.dataset.fileId = file.id;

    const shortSha = file.checksumSha256 ? `${file.checksumSha256.substring(0, 10)}...` : '--';

    tr.innerHTML = `
      <td class="col-name">
        <div class="file-name-cell">
          <div class="file-icon">
            ${getFileIconSvg(file.mimeType, file.originalFilename)}
          </div>
          <div class="file-text-col">
            <span class="file-name-title">${escapeHtml(file.originalFilename)}</span>
            <span class="text-xs text-muted font-mono">${escapeHtml(file.s3ObjectKey ? file.s3ObjectKey.split('/').pop() : '')}</span>
          </div>
        </div>
      </td>
      <td class="col-size text-right tabular-nums">${formatBytes(file.fileSizeBytes)}</td>
      <td class="col-mime font-mono text-xs text-muted">${escapeHtml(file.mimeType || 'binary/octet-stream')}</td>
      <td class="col-crypto">
        <span class="cipher-tag">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          ${escapeHtml(file.encryptionAlgorithm || 'AES-256-GCM')}
        </span>
      </td>
      <td class="col-sha">
        <span class="sha-digest" data-fullsha="${file.checksumSha256 || ''}" title="Click to copy full SHA-256 digest">
          ${escapeHtml(shortSha)}
        </span>
      </td>
      <td class="col-date tabular-nums text-xs">${formatDate(file.createdAt)}</td>
      <td class="col-actions text-right">
        <div class="action-buttons-cell">
          <button type="button" class="btn btn-secondary btn-xs btn-action-download" data-id="${file.id}" title="Decrypt and download">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>Decrypt</span>
          </button>

          <button type="button" class="btn btn-secondary btn-xs btn-action-share" data-id="${file.id}" data-name="${escapeHtml(file.originalFilename)}" title="Generate expiring share link">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            <span>Share</span>
          </button>

          <button type="button" class="btn btn-secondary btn-xs btn-action-delete" data-id="${file.id}" data-name="${escapeHtml(file.originalFilename)}" title="Delete file">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accent-rose)">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </td>
    `;

    DOM.filesTbody.appendChild(tr);
  });

  // Attach dynamic event listeners for row actions
  DOM.filesTbody.querySelectorAll('.btn-action-download').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const fileId = e.currentTarget.dataset.id;
      downloadFile(fileId);
    });
  });

  DOM.filesTbody.querySelectorAll('.btn-action-share').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const fileId = e.currentTarget.dataset.id;
      const fileName = e.currentTarget.dataset.name;
      openShareModal(fileId, fileName);
    });
  });

  DOM.filesTbody.querySelectorAll('.btn-action-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const fileId = e.currentTarget.dataset.id;
      const fileName = e.currentTarget.dataset.name;
      openDeleteModal(fileId, fileName);
    });
  });

  DOM.filesTbody.querySelectorAll('.sha-digest').forEach(el => {
    el.addEventListener('click', () => {
      const fullSha = el.dataset.fullsha;
      if (fullSha) {
        navigator.clipboard.writeText(fullSha);
        showToast('SHA-256 checksum copied to clipboard', 'info');
      }
    });
  });
}

function getFileIconSvg(mimeType = '', filename = '') {
  if (mimeType.includes('pdf') || filename.endsWith('.pdf')) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
  }
  if (mimeType.includes('image') || /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(filename)) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
  }
  if (mimeType.includes('zip') || mimeType.includes('tar') || /\.(zip|tar|gz|rar|7z)$/i.test(filename)) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`;
  }
  if (mimeType.includes('text') || /\.(txt|md|java|json|ts|js|xml|sql)$/i.test(filename)) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="2" x2="22" y2="6"/><path d="M7.5 20.5 19 9l-4-4L3.5 16.5 2 22z"/></svg>`;
  }
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`;
}

// ===================================================================
// FILE UPLOAD HANDLER (DRAG & DROP + MULTIPART API)
// ===================================================================
function initUpload() {
  const dropzone = DOM.uploadDropzone;
  const input = DOM.filePickerInput;

  // Click to trigger browse
  dropzone.addEventListener('click', (e) => {
    // Avoid double triggering when clicking progress box or input itself
    if (e.target.closest('#upload-progress-box') || e.target === input) return;
    input.click();
  });

  DOM.btnQuickUpload.addEventListener('click', () => {
    input.click();
  });

  input.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  });

  // Drag & drop handlers
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files[0]) {
      handleFileUpload(dt.files[0]);
    }
  });
}

async function handleFileUpload(file) {
  if (!file) return;

  // Max 50MB check
  const MAX_BYTES = 50 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    showToast('File exceeds 50MB limit allowed by Spring Boot configuration', 'error');
    return;
  }

  // Quota check
  const remainingQuota = (AppState.stats.storageQuotaBytes || 1073741824) - (AppState.stats.usedStorageBytes || 0);
  if (file.size > remainingQuota) {
    showToast(`Quota exceeded! Storage remaining is only ${formatBytes(remainingQuota)}`, 'error');
    return;
  }

  // Show live progress UI
  DOM.uploadProgressBox.classList.remove('hidden');
  DOM.uploadingFilename.textContent = file.name;
  DOM.uploadingStatusLabel.textContent = 'Generating 12-byte IV & AES-256-GCM cipher...';
  DOM.uploadPercentage.textContent = '0%';
  DOM.uploadProgressBar.style.width = '0%';

  const formData = new FormData();
  formData.append('file', file);

  try {
    // Simulate real upload progress bar
    let progress = 10;
    const progressInterval = setInterval(() => {
      if (progress < 85) {
        progress += Math.floor(Math.random() * 15) + 5;
        if (progress > 85) progress = 85;
        DOM.uploadPercentage.textContent = `${progress}%`;
        DOM.uploadProgressBar.style.width = `${progress}%`;
        if (progress > 40) {
          DOM.uploadingStatusLabel.textContent = 'Transferring encrypted payload to S3...';
        }
      }
    }, 120);

    const res = await apiFetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      body: formData
    });

    clearInterval(progressInterval);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'File upload failed');
    }

    const savedFile = await res.json();

    DOM.uploadPercentage.textContent = '100%';
    DOM.uploadProgressBar.style.width = '100%';
    DOM.uploadingStatusLabel.textContent = 'Encrypted & persisted to S3!';

    showToast(`"${file.name}" encrypted with AES-256-GCM and stored!`, 'success');

    // Refresh files and quota
    await fetchFiles();
    await fetchStorageStats();
    await fetchAuditLogs();

    setTimeout(() => {
      DOM.uploadProgressBox.classList.add('hidden');
      DOM.filePickerInput.value = '';
    }, 1500);

  } catch (err) {
    DOM.uploadProgressBox.classList.add('hidden');
    DOM.filePickerInput.value = '';
    showToast(err.message, 'error');
  }
}

// ===================================================================
// FILE DOWNLOAD & DECRYPTION HANDLER
// ===================================================================
async function downloadFile(fileId) {
  showToast('Retrieving encrypted blob & performing AES-GCM authentication...', 'info');

  try {
    const res = await apiFetch(`${API_BASE}/files/download/${fileId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to download or decrypt file');
    }

    // Extract filename from Content-Disposition header if available
    const disposition = res.headers.get('Content-Disposition') || '';
    let filename = 'decrypted_file';
    const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
    if (match && match[1]) {
      filename = decodeURIComponent(match[1]);
    } else {
      const targetFile = AppState.files.find(f => f.id == fileId);
      if (targetFile) filename = targetFile.originalFilename;
    }

    // Read decrypted stream directly as Blob
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);

    showToast(`Decrypted & saved "${filename}" with full integrity!`, 'success');
    fetchAuditLogs();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===================================================================
// SHARING CONTROLLER (MODAL & GENERATION)
// ===================================================================
function initShare() {
  DOM.btnCloseShareModal.addEventListener('click', closeShareModal);
  DOM.shareModal.addEventListener('click', (e) => {
    if (e.target === DOM.shareModal) closeShareModal();
  });

  DOM.shareForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileId = DOM.modalShareFileId.value;
    const email = DOM.shareRecipientEmail.value.trim();
    const expiryRadio = document.querySelector('input[name="share-expiry"]:checked');
    const expiryHours = parseInt(expiryRadio ? expiryRadio.value : '24', 10);
    const permRadio = document.querySelector('input[name="share-permission"]:checked');
    const permission = permRadio ? permRadio.value : 'DOWNLOAD';

    const btn = document.getElementById('btn-generate-share');
    btn.disabled = true;
    btn.textContent = 'Generating cryptographic token...';

    try {
      const res = await apiFetch(`${API_BASE}/files/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: parseInt(fileId, 10),
          sharedWithEmail: email || null,
          expiryHours,
          permission
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create share link');
      }

      const shareData = await res.json();

      // Show output URL
      const shareUrl = `${window.location.origin}/#share=${shareData.shareToken}`;
      DOM.shareUrlOutput.value = shareUrl;
      DOM.shareResultBox.classList.remove('hidden');

      // Save into local list for the "Shared Links" view
      AppState.sharedLinks.unshift({
        id: shareData.id,
        filename: shareData.filename || DOM.modalShareFilename.textContent,
        shareToken: shareData.shareToken,
        shareUrl: shareUrl,
        sharedWithEmail: email || 'Public Link',
        permission: permission,
        expiresAt: shareData.expiresAt,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('cv_shares', JSON.stringify(AppState.sharedLinks));
      renderSharesTable();
      updateQuotaDisplay();
      fetchAuditLogs();

      showToast('Share link created with UUID security token!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate Share Link';
    }
  });

  DOM.btnCopyShareUrl.addEventListener('click', () => {
    const url = DOM.shareUrlOutput.value;
    if (url) {
      navigator.clipboard.writeText(url);
      showToast('Share link copied to clipboard!', 'info');
    }
  });

  DOM.btnTestShareLink.addEventListener('click', () => {
    const url = DOM.shareUrlOutput.value;
    const token = url.split('#share=')[1];
    if (token) {
      closeShareModal();
      openPublicShareModal(token);
    }
  });

  // Public Share Modal handlers
  DOM.btnClosePublicModal.addEventListener('click', () => {
    DOM.publicShareModal.classList.add('hidden');
  });

  DOM.btnPublicDownload.addEventListener('click', async () => {
    if (!AppState.currentPublicToken) return;
    DOM.btnPublicDownload.disabled = true;
    DOM.btnPublicDownload.textContent = 'Decrypting payload...';

    try {
      const res = await fetch(`${API_BASE}/public/share/${AppState.currentPublicToken}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Share link expired or invalid');
      }

      const disposition = res.headers.get('Content-Disposition') || '';
      let filename = 'shared_download';
      const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
      if (match && match[1]) filename = decodeURIComponent(match[1]);

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showToast(`Downloaded "${filename}" via public share token!`, 'success');
      DOM.publicShareModal.classList.add('hidden');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      DOM.btnPublicDownload.disabled = false;
      DOM.btnPublicDownload.textContent = 'Decrypt & Download File';
    }
  });
}

function openShareModal(fileId, fileName) {
  DOM.modalShareFileId.value = fileId;
  DOM.modalShareFilename.textContent = fileName;
  DOM.shareRecipientEmail.value = '';
  DOM.shareResultBox.classList.add('hidden');
  DOM.shareUrlOutput.value = '';
  DOM.shareModal.classList.remove('hidden');
}

function closeShareModal() {
  DOM.shareModal.classList.add('hidden');
}

function openPublicShareModal(token) {
  AppState.currentPublicToken = token;
  const matchShare = AppState.sharedLinks.find(s => s.shareToken === token);
  DOM.pubFilename.textContent = matchShare ? matchShare.filename : 'Secure Shared Asset';
  DOM.pubMeta.textContent = matchShare
    ? `Expires: ${formatDate(matchShare.expiresAt)} · Permission: ${matchShare.permission}`
    : 'Verified AES-256-GCM Encrypted Blob';
  DOM.publicShareModal.classList.remove('hidden');
}

function renderSharesTable() {
  DOM.sharesTbody.innerHTML = '';
  if (!AppState.sharedLinks || AppState.sharedLinks.length === 0) {
    DOM.sharesEmptyState.classList.remove('hidden');
    return;
  }

  DOM.sharesEmptyState.classList.add('hidden');

  AppState.sharedLinks.forEach((s, idx) => {
    const isExpired = new Date(s.expiresAt) < new Date();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-medium text-white">${escapeHtml(s.filename)}</td>
      <td class="text-xs text-muted">${escapeHtml(s.sharedWithEmail || 'Public')}</td>
      <td><span class="font-mono text-xs">${escapeHtml(s.permission)}</span></td>
      <td><span class="font-mono text-xs text-muted">${escapeHtml(s.shareToken.substring(0, 12))}...</span></td>
      <td class="tabular-nums text-xs">${formatDate(s.expiresAt)}</td>
      <td>
        <span class="text-xs" style="color:${isExpired ? 'var(--accent-rose)' : 'var(--accent-emerald)'}">
          ${isExpired ? 'Expired' : 'Active'}
        </span>
      </td>
      <td class="text-right">
        <button type="button" class="btn btn-secondary btn-xs btn-test-share" data-token="${s.shareToken}">
          Open
        </button>
      </td>
    `;
    DOM.sharesTbody.appendChild(tr);
  });

  DOM.sharesTbody.querySelectorAll('.btn-test-share').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const token = e.currentTarget.dataset.token;
      openPublicShareModal(token);
    });
  });
}

// ===================================================================
// FILE DELETION HANDLER
// ===================================================================
function initDelete() {
  DOM.btnCloseDeleteModal.addEventListener('click', closeDeleteModal);
  DOM.btnCancelDelete.addEventListener('click', closeDeleteModal);

  DOM.deleteModal.addEventListener('click', (e) => {
    if (e.target === DOM.deleteModal) closeDeleteModal();
  });

  DOM.btnConfirmDelete.addEventListener('click', async () => {
    if (!AppState.pendingDeleteFileId) return;

    DOM.btnConfirmDelete.disabled = true;
    DOM.btnConfirmDelete.textContent = 'Purging encrypted blob...';

    try {
      const res = await apiFetch(`${API_BASE}/files/${AppState.pendingDeleteFileId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to delete file');
      }

      showToast('File removed from S3 storage and quota reclaimed', 'success');
      closeDeleteModal();
      await fetchFiles();
      await fetchStorageStats();
      await fetchAuditLogs();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      DOM.btnConfirmDelete.disabled = false;
      DOM.btnConfirmDelete.textContent = 'Permanently Delete';
    }
  });
}

function openDeleteModal(fileId, fileName) {
  AppState.pendingDeleteFileId = fileId;
  DOM.deleteFilenameTarget.textContent = fileName;
  DOM.deleteModal.classList.remove('hidden');
}

function closeDeleteModal() {
  AppState.pendingDeleteFileId = null;
  DOM.deleteModal.classList.add('hidden');
}

// ===================================================================
// AUDIT LOGS CONTROLLER
// ===================================================================
async function fetchAuditLogs() {
  if (!AppState.token) return;

  try {
    const res = await apiFetch(`${API_BASE}/audit-logs`);
    if (res.ok) {
      AppState.auditLogs = await res.json();
      renderAuditLogs();
    }
  } catch (err) {
    console.warn('Could not fetch audit logs:', err);
  }
}

function renderAuditLogs() {
  DOM.auditTbody.innerHTML = '';
  if (!AppState.auditLogs || AppState.auditLogs.length === 0) {
    DOM.auditTbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No audit entries yet</td></tr>`;
    return;
  }

  AppState.auditLogs.slice(0, 50).forEach(log => {
    const tr = document.createElement('tr');

    let badgeColor = 'var(--text-secondary)';
    if (log.actionType === 'UPLOAD') badgeColor = 'var(--accent-cyan)';
    else if (log.actionType === 'DOWNLOAD') badgeColor = 'var(--accent-emerald)';
    else if (log.actionType === 'DELETE') badgeColor = 'var(--accent-rose)';
    else if (log.actionType === 'ACCESS_DENIED') badgeColor = 'var(--accent-amber)';

    tr.innerHTML = `
      <td class="tabular-nums text-xs">${formatDate(log.createdAt)}</td>
      <td>
        <span class="font-mono text-xs font-semibold" style="color:${badgeColor}">
          ${escapeHtml(log.actionType)}
        </span>
      </td>
      <td class="font-mono text-xs text-muted">${log.fileId || '--'}</td>
      <td class="font-mono text-xs">${escapeHtml(log.ipAddress || '127.0.0.1')}</td>
      <td class="text-xs text-light">${escapeHtml(log.details || '')}</td>
    `;
    DOM.auditTbody.appendChild(tr);
  });
}

// ===================================================================
// SPRING BOOT 3 JAVA ARCHITECTURE & CODE EXPLORER
// ===================================================================
async function initJavaExplorer() {
  DOM.treeItems.forEach(item => {
    item.addEventListener('click', () => {
      DOM.treeItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const filename = item.dataset.file;
      loadJavaSourceFile(filename);
    });
  });

  DOM.btnCopyJavaCode.addEventListener('click', () => {
    const code = DOM.codeDisplay.textContent;
    if (code) {
      navigator.clipboard.writeText(code);
      showToast(`Copied ${DOM.viewerFilename.textContent} to clipboard!`, 'info');
    }
  });

  // Load initial file
  loadJavaSourceFile('application.properties');
}

async function loadJavaSourceFile(filename) {
  DOM.viewerFilename.textContent = filename;
  DOM.codeDisplay.textContent = 'Loading source code...';

  // Check cache first
  if (AppState.javaSources[filename]) {
    DOM.codeDisplay.textContent = AppState.javaSources[filename];
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/architecture/file?name=${encodeURIComponent(filename)}`);
    if (res.ok) {
      const text = await res.text();
      AppState.javaSources[filename] = text;
      DOM.codeDisplay.textContent = text;
    } else {
      DOM.codeDisplay.textContent = `// File: ${filename}\n// Source code available on the Spring Boot 3 backend filesystem at /backend-java-springboot/`;
    }
  } catch (err) {
    DOM.codeDisplay.textContent = `// Could not fetch file from server.\n// Inspect local repository at /backend-java-springboot/`;
  }
}

// ===================================================================
// NAVIGATION & SEARCH
// ===================================================================
function initNavigation() {
  DOM.navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.navItems.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const viewId = btn.dataset.view;
      AppState.currentView = viewId;

      document.querySelectorAll('.viewport-section').forEach(sec => sec.classList.add('hidden'));

      if (viewId === 'files-view') {
        document.getElementById('view-files').classList.remove('hidden');
      } else if (viewId === 'shared-view') {
        document.getElementById('view-shared').classList.remove('hidden');
        renderSharesTable();
      } else if (viewId === 'audit-view') {
        document.getElementById('view-audit').classList.remove('hidden');
        fetchAuditLogs();
      } else if (viewId === 'java-view') {
        document.getElementById('view-java').classList.remove('hidden');
      } else if (viewId === 'settings-view') {
        document.getElementById('view-settings').classList.remove('hidden');
      }
    });
  });

  // Search input handler
  DOM.fileSearchInput.addEventListener('input', (e) => {
    AppState.searchQuery = e.target.value;
    if (AppState.searchQuery) {
      DOM.btnClearSearch.classList.remove('hidden');
    } else {
      DOM.btnClearSearch.classList.add('hidden');
    }
    renderFilesTable();
  });

  DOM.btnClearSearch.addEventListener('click', () => {
    DOM.fileSearchInput.value = '';
    AppState.searchQuery = '';
    DOM.btnClearSearch.classList.add('hidden');
    renderFilesTable();
  });

  DOM.btnRefreshFiles.addEventListener('click', () => {
    fetchFiles();
    fetchStorageStats();
    showToast('Vault repository synced with cloud storage', 'info');
  });

  DOM.btnRefreshAudit.addEventListener('click', () => {
    fetchAuditLogs();
    showToast('Audit trail refreshed', 'info');
  });
}

// Handle URL hash on load (e.g. #share=TOKEN)
function checkUrlHashShare() {
  if (window.location.hash.startsWith('#share=')) {
    const token = window.location.hash.replace('#share=', '').trim();
    if (token) {
      setTimeout(() => openPublicShareModal(token), 300);
    }
  }
}

// ===================================================================
// APPLICATION INITIALIZATION
// ===================================================================
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initNavigation();
  initUpload();
  initShare();
  initDelete();
  initJavaExplorer();
  updateAppView();

  if (AppState.token) {
    fetchFiles();
    fetchStorageStats();
    fetchAuditLogs();
  }

  checkUrlHashShare();
});
