package com.cloudvault.dto;

import com.cloudvault.entity.AccessPermission;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShareResponseDto {

    private Long id;
    private Long fileId;
    private String filename;
    private String shareToken;
    private String shareUrl;
    private String sharedWithEmail;
    private AccessPermission permission;
    private Instant expiresAt;
    private Instant createdAt;
}
