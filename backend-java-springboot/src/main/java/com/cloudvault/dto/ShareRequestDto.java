package com.cloudvault.dto;

import com.cloudvault.entity.AccessPermission;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShareRequestDto {

    @NotNull(message = "File ID is required")
    private Long fileId;

    private String sharedWithEmail;

    @Builder.Default
    @Min(value = 1, message = "Minimum expiry is 1 hour")
    @Max(value = 168, message = "Maximum expiry is 168 hours (7 days)")
    private Integer expiryHours = 24;

    @Builder.Default
    private AccessPermission permission = AccessPermission.DOWNLOAD;
}
