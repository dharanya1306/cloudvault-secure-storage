package com.cloudvault.controller;

import com.cloudvault.dto.AuditLogDto;
import com.cloudvault.entity.AuditLog;
import com.cloudvault.entity.Role;
import com.cloudvault.entity.User;
import com.cloudvault.service.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/audit-logs")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditService auditService;

    @GetMapping
    public ResponseEntity<List<AuditLogDto>> getAuditLogs(@AuthenticationPrincipal User currentUser) {
        List<AuditLog> logs;
        if (currentUser.getRole() == Role.ROLE_ADMIN) {
            logs = auditService.getAllAuditLogs();
        } else {
            logs = auditService.getUserAuditLogs(currentUser.getId());
        }

        List<AuditLogDto> dtos = logs.stream()
                .map(l -> AuditLogDto.builder()
                        .id(l.getId())
                        .userId(l.getUserId())
                        .actionType(l.getActionType())
                        .fileId(l.getFileId())
                        .ipAddress(l.getIpAddress())
                        .details(l.getDetails())
                        .createdAt(l.getCreatedAt())
                        .build())
                .collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }
}
