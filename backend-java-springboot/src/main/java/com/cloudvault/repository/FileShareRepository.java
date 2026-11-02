package com.cloudvault.repository;

import com.cloudvault.entity.FileMetadata;
import com.cloudvault.entity.FileShare;
import com.cloudvault.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FileShareRepository extends JpaRepository<FileShare, Long> {

    Optional<FileShare> findByShareToken(String shareToken);

    List<FileShare> findBySharedByOrderByCreatedAtDesc(User sharedBy);

    List<FileShare> findByFileAndSharedBy(FileMetadata file, User sharedBy);
}
