package com.cloudvault.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileResponseDto {

    private Long id;
    private String originalFilename;
    private String s3ObjectKey;
    private Long fileSizeBytes;
    private String mimeType;
    private String encryptionAlgorithm;
    private String checksumSha256;
    private Instant createdAt;
    private String ownerUsername;
}
