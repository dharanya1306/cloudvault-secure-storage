package com.cloudvault.repository;

import com.cloudvault.entity.FileMetadata;
import com.cloudvault.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FileMetadataRepository extends JpaRepository<FileMetadata, Long> {

    List<FileMetadata> findByOwnerAndIsDeletedFalseOrderByCreatedAtDesc(User owner);

    Optional<FileMetadata> findByIdAndOwnerAndIsDeletedFalse(Long id, User owner);

    Optional<FileMetadata> findByIdAndIsDeletedFalse(Long id);

    Optional<FileMetadata> findByS3ObjectKeyAndIsDeletedFalse(String s3ObjectKey);

    long countByOwnerAndIsDeletedFalse(User owner);

    @Query("SELECT COALESCE(SUM(f.fileSizeBytes), 0) FROM FileMetadata f WHERE f.owner = :owner AND f.isDeleted = false")
    Long calculateTotalStorageUsedByOwner(@Param("owner") User owner);
}
