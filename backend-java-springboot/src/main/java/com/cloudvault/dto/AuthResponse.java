package com.cloudvault.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {

    private String token;
    @Builder.Default
    private String tokenType = "Bearer";
    private Long expiresInMs;
    private Long userId;
    private String username;
    private String email;
    private String role;
    private Long storageQuotaBytes;
    private Long usedStorageBytes;
}
