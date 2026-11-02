package com.cloudvault.service;

import com.cloudvault.crypto.EncryptionService;
import com.cloudvault.dto.FileResponseDto;
import com.cloudvault.dto.FileStatsResponse;
import com.cloudvault.dto.ShareRequestDto;
import com.cloudvault.dto.ShareResponseDto;
import com.cloudvault.entity.*;
import com.cloudvault.exception.AccessDeniedException;
import com.cloudvault.exception.InvalidShareTokenException;
import com.cloudvault.exception.ResourceNotFoundException;
import com.cloudvault.exception.StorageQuotaExceededException;
import com.cloudvault.repository.FileMetadataRepository;
import com.cloudvault.repository.FileShareRepository;
import com.cloudvault.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class FileService {

    private final FileMetadataRepository fileMetadataRepository;
    private final FileShareRepository fileShareRepository;
    private final UserRepository userRepository;
    private final S3StorageService s3StorageService;
    private final EncryptionService encryptionService;
    private final AuditService auditService;

    @Value("${app.base-url:http://localhost:3000}")
    private String appBaseUrl;

    public record DecryptedFile(
            String originalFilename,
            String mimeType,
            byte[] content,
            long sizeBytes,
            String checksumSha256
    ) {}

    /**
     * Uploads, verifies quota, calculates SHA-256, encrypts with AES-256-GCM, stores to S3, and audits.
     */
    @Transactional
    public FileResponseDto uploadFile(MultipartFile file, User user, String ipAddress) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Cannot upload an empty file");
        }

        long fileSize = file.getSize();
        long projectedStorage = user.getUsedStorageBytes() + fileSize;

        // 1. Storage Quota Check
        if (projectedStorage > user.getStorageQuotaBytes()) {
            log.warn("Storage quota exceeded for user {}: attempting {} bytes, quota remaining {} bytes",
                    user.getUsername(), fileSize, (user.getStorageQuotaBytes() - user.getUsedStorageBytes()));
            auditService.logActionAsync(
                    user.getId(),
                    ActionType.UPLOAD,
                    null,
                    ipAddress,
                    "Upload rejected: storage quota exceeded for file '" + file.getOriginalFilename() + "'"
            );
            throw new StorageQuotaExceededException("Storage quota exceeded! Maximum allowed quota is "
                    + (user.getStorageQuotaBytes() / (1024 * 1024)) + " MB");
        }

        byte[] originalBytes = file.getBytes();

        // 2. Compute SHA-256 Checksum on raw plaintext
        String checksumSha256 = calculateSha256(originalBytes);

        // 3. Encrypt payload via AES-256-GCM (Prepends 12-byte IV)
        byte[] encryptedBytes = encryptionService.encrypt(originalBytes);

        // 4. Construct unique S3 object key
        String safeFilename = sanitizeFilename(file.getOriginalFilename());
        String s3Key = "vault/" + user.getId() + "/" + UUID.randomUUID() + "_" + safeFilename + ".enc";

        // 5. Upload encrypted bytes to AWS S3
        s3StorageService.uploadBytes(s3Key, encryptedBytes, file.getContentType());

        // 6. Save Metadata in MySQL
        FileMetadata metadata = FileMetadata.builder()
                .owner(user)
                .originalFilename(safeFilename)
                .s3ObjectKey(s3Key)
                .s3Bucket(s3StorageService.getBucketName())
                .fileSizeBytes(fileSize)
                .mimeType(file.getContentType() != null ? file.getContentType() : "application/octet-stream")
                .encryptionAlgorithm("AES-256-GCM")
                .checksumSha256(checksumSha256)
                .isDeleted(false)
                .build();

        FileMetadata savedMetadata = fileMetadataRepository.save(metadata);

        // 7. Update User storage quota tally
        user.setUsedStorageBytes(projectedStorage);
        userRepository.save(user);

        // 8. Audit Log
        auditService.logActionAsync(
                user.getId(),
                ActionType.UPLOAD,
                savedMetadata.getId(),
                ipAddress,
                "Uploaded & encrypted file '" + safeFilename + "' (" + fileSize + " bytes, SHA-256: " + checksumSha256.substring(0, 8) + "...)"
        );

        return mapToFileResponse(savedMetadata);
    }

    /**
     * Downloads encrypted bytes from S3, authenticates and decrypts with AES-256-GCM, and logs audit.
     */
    @Transactional(readOnly = true)
    public DecryptedFile downloadFile(Long fileId, User currentUser, String ipAddress) {
        FileMetadata file = fileMetadataRepository.findByIdAndIsDeletedFalse(fileId)
                .orElseThrow(() -> new ResourceNotFoundException("File with ID " + fileId + " not found"));

        // Validate Ownership or ROLE_ADMIN
        boolean isOwner = file.getOwner().getId().equals(currentUser.getId());
        boolean isAdmin = currentUser.getRole() == Role.ROLE_ADMIN;

        if (!isOwner && !isAdmin) {
            auditService.logActionAsync(
                    currentUser.getId(),
                    ActionType.ACCESS_DENIED,
                    fileId,
                    ipAddress,
                    "Unauthorized attempt to download file ID: " + fileId
            );
            throw new AccessDeniedException("You do not have permission to access this file");
        }

        // 1. Download encrypted ciphertext from S3
        byte[] encryptedBytes = s3StorageService.downloadBytes(file.getS3ObjectKey());

        // 2. Decrypt with AES-256-GCM (extracts 12-byte IV and decrypts)
        byte[] decryptedBytes = encryptionService.decrypt(encryptedBytes);

        // 3. Log Audit
        auditService.logActionAsync(
                currentUser.getId(),
                ActionType.DOWNLOAD,
                file.getId(),
                ipAddress,
                "Decrypted & downloaded file '" + file.getOriginalFilename() + "'"
        );

        return new DecryptedFile(
                file.getOriginalFilename(),
                file.getMimeType(),
                decryptedBytes,
                file.getFileSizeBytes(),
                file.getChecksumSha256()
        );
    }

    /**
     * Generates a time-bound shareable link with UUID token.
     */
    @Transactional
    public ShareResponseDto shareFile(ShareRequestDto request, User currentUser, String ipAddress) {
        FileMetadata file = fileMetadataRepository.findByIdAndOwnerAndIsDeletedFalse(request.getFileId(), currentUser)
                .orElseThrow(() -> new ResourceNotFoundException("File not found or access denied"));

        String token = UUID.randomUUID().toString().replace("-", "");
        Instant expiresAt = Instant.now().plus(request.getExpiryHours(), ChronoUnit.HOURS);

        FileShare fileShare = FileShare.builder()
                .file(file)
                .sharedBy(currentUser)
                .sharedWithEmail(request.getSharedWithEmail())
                .shareToken(token)
                .accessPermission(request.getPermission())
                .expiresAt(expiresAt)
                .build();

        FileShare saved = fileShareRepository.save(fileShare);

        auditService.logActionAsync(
                currentUser.getId(),
                ActionType.SHARE_CREATED,
                file.getId(),
                ipAddress,
                "Created share link expiring in " + request.getExpiryHours() + "h (Permission: " + request.getPermission() + ")"
        );

        String shareUrl = appBaseUrl + "/share.html?token=" + token;

        return ShareResponseDto.builder()
                .id(saved.getId())
                .fileId(file.getId())
                .filename(file.getOriginalFilename())
                .shareToken(token)
                .shareUrl(shareUrl)
                .sharedWithEmail(saved.getSharedWithEmail())
                .permission(saved.getAccessPermission())
                .expiresAt(saved.getExpiresAt())
                .createdAt(saved.getCreatedAt())
                .build();
    }

    /**
     * Retrieves and decrypts a file using a public valid share token.
     */
    @Transactional(readOnly = true)
    public DecryptedFile getSharedFile(String token, String ipAddress) {
        FileShare share = fileShareRepository.findByShareToken(token)
                .orElseThrow(() -> new InvalidShareTokenException("Share link is invalid or has been revoked"));

        if (share.isExpired()) {
            auditService.logActionAsync(
                    share.getSharedBy().getId(),
                    ActionType.ACCESS_DENIED,
                    share.getFile().getId(),
                    ipAddress,
                    "Expired share link access attempted (Token: " + token + ")"
            );
            throw new InvalidShareTokenException("Share link has expired on " + share.getExpiresAt());
        }

        FileMetadata file = share.getFile();
        if (file.getIsDeleted()) {
            throw new ResourceNotFoundException("The requested file is no longer available");
        }

        byte[] encryptedBytes = s3StorageService.downloadBytes(file.getS3ObjectKey());
        byte[] decryptedBytes = encryptionService.decrypt(encryptedBytes);

        auditService.logActionAsync(
                share.getSharedBy().getId(),
                ActionType.DOWNLOAD,
                file.getId(),
                ipAddress,
                "Shared file accessed via token: " + token.substring(0, 8) + "..."
        );

        return new DecryptedFile(
                file.getOriginalFilename(),
                file.getMimeType(),
                decryptedBytes,
                file.getFileSizeBytes(),
                file.getChecksumSha256()
        );
    }

    /**
     * Soft-deletes file, cleans up S3 object, decrements user storage quota, and audits.
     */
    @Transactional
    public void deleteFile(Long fileId, User currentUser, String ipAddress) {
        FileMetadata file = fileMetadataRepository.findByIdAndOwnerAndIsDeletedFalse(fileId, currentUser)
                .orElseThrow(() -> new ResourceNotFoundException("File not found or permission denied"));

        // Delete from S3 storage
        try {
            s3StorageService.deleteObject(file.getS3ObjectKey());
        } catch (Exception ex) {
            log.warn("S3 delete warning for key {}: {}", file.getS3ObjectKey(), ex.getMessage());
        }

        // Mark as deleted in MySQL
        file.setIsDeleted(true);
        fileMetadataRepository.save(file);

        // Update User Storage Quota
        long currentUsed = currentUser.getUsedStorageBytes();
        long newUsed = Math.max(0L, currentUsed - file.getFileSizeBytes());
        currentUser.setUsedStorageBytes(newUsed);
        userRepository.save(currentUser);

        auditService.logActionAsync(
                currentUser.getId(),
                ActionType.DELETE,
                file.getId(),
                ipAddress,
                "Deleted file '" + file.getOriginalFilename() + "' (" + file.getFileSizeBytes() + " bytes reclaimed)"
        );
    }

    @Transactional(readOnly = true)
    public List<FileResponseDto> getUserFiles(User currentUser) {
        return fileMetadataRepository.findByOwnerAndIsDeletedFalseOrderByCreatedAtDesc(currentUser)
                .stream()
                .map(this::mapToFileResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public FileStatsResponse getStorageStats(User currentUser) {
        long used = currentUser.getUsedStorageBytes();
        long quota = currentUser.getStorageQuotaBytes();
        long available = Math.max(0L, quota - used);
        double usagePercentage = quota > 0 ? ((double) used / quota) * 100.0 : 0.0;
        long totalFiles = fileMetadataRepository.countByOwnerAndIsDeletedFalse(currentUser);

        return FileStatsResponse.builder()
                .storageQuotaBytes(quota)
                .usedStorageBytes(used)
                .availableStorageBytes(available)
                .usagePercentage(Math.round(usagePercentage * 100.0) / 100.0)
                .totalFiles(totalFiles)
                .encryptedFiles(totalFiles)
                .build();
    }

    private FileResponseDto mapToFileResponse(FileMetadata meta) {
        return FileResponseDto.builder()
                .id(meta.getId())
                .originalFilename(meta.getOriginalFilename())
                .s3ObjectKey(meta.getS3ObjectKey())
                .fileSizeBytes(meta.getFileSizeBytes())
                .mimeType(meta.getMimeType())
                .encryptionAlgorithm(meta.getEncryptionAlgorithm())
                .checksumSha256(meta.getChecksumSha256())
                .createdAt(meta.getCreatedAt())
                .ownerUsername(meta.getOwner().getUsername())
                .build();
    }

    private String calculateSha256(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data);
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException ex) {
            throw new RuntimeException("SHA-256 algorithm not available in JVM", ex);
        }
    }

    private String sanitizeFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            return "unnamed_file";
        }
        return filename.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
