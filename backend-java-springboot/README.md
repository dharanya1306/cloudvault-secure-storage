# CloudVault – Secure Cloud File Storage and Access Management System
## Production-Grade Spring Boot 3 Backend Architecture

### Tech Stack
- **Framework:** Spring Boot 3.3.0 / Java 17+
- **Security:** Spring Security 6 (Stateless JWT Filter with JJWT 0.12.5)
- **Data Persistence:** Spring Data JPA + Hibernate + MySQL
- **Object Storage:** AWS SDK for Java v2 (`software.amazon.awssdk:s3:2.25.35`)
- **Cryptography:** AES/GCM/NoPadding (256-bit Key, 128-bit Auth Tag, 12-byte cryptographically secure random IV)
- **Boilerplate Reduction:** Project Lombok

---

### Core Security Architecture

#### 1. Cryptography Service (`EncryptionService.java`)
- **Algorithm:** AES/GCM/NoPadding (Galois/Counter Mode).
- **IV Generation:** 12-byte unique cryptographic initialization vector generated per encryption using `java.security.SecureRandom`.
- **Payload Layout:**
  `[ 12-Byte IV ] + [ Ciphertext Body ] + [ 16-Byte GCM Authentication Tag (128 bits) ]`
- **Decryption:** The first 12 bytes are peeled off as the IV to re-initialize the `Cipher` in `DECRYPT_MODE` with `GCMParameterSpec(128, iv)`. The cipher strictly verifies the authentication tag before returning decrypted plaintext. Any bit modification results in immediate cryptographic rejection.

#### 2. Storage Quota Enforcement
- Every user is provisioned with a 1GB (`1,073,741,824 bytes`) default quota.
- On each upload attempt, `user.getUsedStorageBytes() + file.getSize()` is strictly evaluated inside a transactional boundary. If exceeded, a `StorageQuotaExceededException` (HTTP 413) is thrown immediately before any encryption or S3 network operations occur.
- Deletions automatically reclaim storage bytes and sync the user's allocated storage usage.

#### 3. Audit Logging
Every critical action is logged to the MySQL `audit_logs` table:
- `LOGIN` & `LOGOUT`
- `UPLOAD` (includes filename, file size, and SHA-256 digest)
- `DOWNLOAD` (includes decryption audit trail)
- `DELETE` (includes reclaimed storage tally)
- `SHARE_CREATED` (includes expiration and access permission)
- `ACCESS_DENIED` (logs IP, user, and unauthorized resource access attempts)

---

### REST API Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new user account | Public |
| `POST` | `/api/auth/login` | Authenticate and obtain JJWT token | Public |
| `POST` | `/api/files/upload` | Upload & encrypt file (up to 50MB) | `ROLE_USER` / `ROLE_ADMIN` |
| `GET` | `/api/files/my-files` | List non-deleted user files | `ROLE_USER` / `ROLE_ADMIN` |
| `GET` | `/api/files/download/{id}` | Download and decrypt file bytes | Owner / Admin |
| `DELETE` | `/api/files/{id}` | Reclaim storage & delete from S3 | Owner / Admin |
| `GET` | `/api/files/stats` | Storage quota usage & file counts | Authenticated |
| `POST` | `/api/files/share` | Create time-bound UUID share link | Owner |
| `GET` | `/api/public/share/{token}` | Public access to shared file | Public (token checked) |
| `GET` | `/api/audit-logs` | Retrieve chronological security audit trail | Authenticated |

---

### Build & Run Instructions

```bash
# 1. Compile and package the Spring Boot JAR
cd backend-java-springboot
mvn clean package -DskipTests

# 2. Run the application
java -jar target/cloudvault-backend-1.0.0-SNAPSHOT.jar
```
