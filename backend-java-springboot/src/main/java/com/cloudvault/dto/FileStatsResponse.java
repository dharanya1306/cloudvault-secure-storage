package com.cloudvault.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileStatsResponse {

    private Long storageQuotaBytes;
    private Long usedStorageBytes;
    private Long availableStorageBytes;
    private Double usagePercentage;
    private Long totalFiles;
    private Long encryptedFiles;
}
