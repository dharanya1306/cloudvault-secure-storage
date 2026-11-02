package com.cloudvault.dto;

import com.cloudvault.entity.ActionType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogDto {

    private Long id;
    private Long userId;
    private ActionType actionType;
    private Long fileId;
    private String ipAddress;
    private String details;
    private Instant createdAt;
}
