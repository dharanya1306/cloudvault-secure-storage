package com.cloudvault.service;

import com.cloudvault.entity.ActionType;
import com.cloudvault.entity.AuditLog;
import com.cloudvault.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    @Async
    public void logActionAsync(Long userId, ActionType actionType, Long fileId, String ipAddress, String details) {
        try {
            AuditLog auditLog = AuditLog.builder()
                    .userId(userId)
                    .actionType(actionType)
                    .fileId(fileId)
                    .ipAddress(ipAddress)
                    .details(details)
                    .build();
            auditLogRepository.save(auditLog);
            log.debug("Audit logged: action={}, user={}, file={}", actionType, userId, fileId);
        } catch (Exception ex) {
            log.error("Failed to persist audit log: {}", ex.getMessage(), ex);
        }
    }

    public void logAction(Long userId, ActionType actionType, Long fileId, String ipAddress, String details) {
        AuditLog auditLog = AuditLog.builder()
                .userId(userId)
                .actionType(actionType)
                .fileId(fileId)
                .ipAddress(ipAddress)
                .details(details)
                .build();
        auditLogRepository.save(auditLog);
    }

    public List<AuditLog> getUserAuditLogs(Long userId) {
        return auditLogRepository.findTop50ByUserIdOrderByCreatedAtDesc(userId);
    }

    public List<AuditLog> getAllAuditLogs() {
        return auditLogRepository.findTop100ByOrderByCreatedAtDesc();
    }
}
