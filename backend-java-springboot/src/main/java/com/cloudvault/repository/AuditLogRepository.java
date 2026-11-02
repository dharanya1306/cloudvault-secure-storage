package com.cloudvault.repository;

import com.cloudvault.entity.ActionType;
import com.cloudvault.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    List<AuditLog> findByUserIdOrderByCreatedAtDesc(Long userId);

    Page<AuditLog> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    List<AuditLog> findByActionTypeOrderByCreatedAtDesc(ActionType actionType);

    List<AuditLog> findTop50ByUserIdOrderByCreatedAtDesc(Long userId);

    List<AuditLog> findTop100ByOrderByCreatedAtDesc();
}
