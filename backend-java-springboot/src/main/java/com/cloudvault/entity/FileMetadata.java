package com.cloudvault.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;

@Entity
@Table(name = "file_metadata", indexes = {
    @Index(name = "idx_file_owner_deleted", columnList = "owner_id, is_deleted"),
    @Index(name = "idx_file_s3_key", columnList = "s3_object_key")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FileMetadata {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(name = "original_filename", nullable = false, length = 255)
    private String originalFilename;

    @Column(name = "s3_object_key", nullable = false, unique = true, length = 255)
    private String s3ObjectKey;

    @Column(name = "s3_bucket", nullable = false, length = 120)
    private String s3Bucket;

    @Column(name = "file_size_bytes", nullable = false)
    private Long fileSizeBytes;

    @Column(name = "mime_type", nullable = false, length = 100)
    private String mimeType;

    @Builder.Default
    @Column(name = "encryption_algorithm", nullable = false, length = 50)
    private String encryptionAlgorithm = "AES-256-GCM";

    @Column(name = "checksum_sha256", nullable = false, length = 64)
    private String checksumSha256;

    @Builder.Default
    @Column(name = "is_deleted", nullable = false)
    private Boolean isDeleted = false;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
