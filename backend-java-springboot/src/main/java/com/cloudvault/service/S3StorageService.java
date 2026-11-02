package com.cloudvault.service;

import com.cloudvault.exception.FileStorageException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.time.Duration;

/**
 * AWS SDK for Java v2 S3 storage adapter.
 * Handles encrypted blob persistence, retrieval, deletion, and presigned URL generation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class S3StorageService {

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;

    @Value("${cloudvault.aws.s3.bucket-name}")
    private String bucketName;

    /**
     * Uploads raw encrypted byte array into S3 object store.
     *
     * @param key S3 Object key (e.g. users/{userId}/{uuid}_{filename}.enc)
     * @param content Encrypted payload bytes
     * @param contentType Content MIME type
     */
    public void uploadBytes(String key, byte[] content, String contentType) {
        try {
            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .contentType(contentType != null ? contentType : "application/octet-stream")
                    .contentLength((long) content.length)
                    .build();

            s3Client.putObject(putObjectRequest, RequestBody.fromBytes(content));
            log.info("Successfully uploaded object to S3: bucket={}, key={}, sizeBytes={}", bucketName, key, content.length);
        } catch (S3Exception ex) {
            log.error("AWS S3 error while uploading key '{}': {}", key, ex.awsErrorDetails().errorMessage(), ex);
            throw new FileStorageException("Could not persist encrypted object in S3: " + ex.awsErrorDetails().errorMessage(), ex);
        } catch (Exception ex) {
            log.error("Unexpected error during S3 upload of key '{}': {}", key, ex.getMessage(), ex);
            throw new FileStorageException("Failed to upload file to cloud storage", ex);
        }
    }

    /**
     * Downloads raw encrypted byte array from S3 object store.
     *
     * @param key S3 Object key
     * @return Raw encrypted byte array
     */
    public byte[] downloadBytes(String key) {
        try {
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build();

            return s3Client.getObjectAsBytes(getObjectRequest).asByteArray();
        } catch (NoSuchKeyException ex) {
            log.error("S3 Object not found: bucket={}, key={}", bucketName, key);
            throw new FileStorageException("Object not found in storage: " + key, ex);
        } catch (S3Exception ex) {
            log.error("AWS S3 error while downloading key '{}': {}", key, ex.awsErrorDetails().errorMessage(), ex);
            throw new FileStorageException("Could not retrieve object from S3: " + ex.awsErrorDetails().errorMessage(), ex);
        } catch (Exception ex) {
            log.error("Unexpected error during S3 download of key '{}': {}", key, ex.getMessage(), ex);
            throw new FileStorageException("Failed to download file from cloud storage", ex);
        }
    }

    /**
     * Deletes an object from S3.
     *
     * @param key S3 Object key
     */
    public void deleteObject(String key) {
        try {
            DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build();

            s3Client.deleteObject(deleteObjectRequest);
            log.info("Deleted object from S3: bucket={}, key={}", bucketName, key);
        } catch (S3Exception ex) {
            log.error("AWS S3 error while deleting key '{}': {}", key, ex.awsErrorDetails().errorMessage(), ex);
            throw new FileStorageException("Failed to delete object from S3: " + ex.awsErrorDetails().errorMessage(), ex);
        }
    }

    /**
     * Generates a time-bound presigned GET URL for temporary direct access.
     *
     * @param key S3 Object key
     * @param duration Time window for link validity
     * @return Presigned URL string
     */
    public String generatePresignedUrl(String key, Duration duration) {
        try {
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build();

            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(duration)
                    .getObjectRequest(getObjectRequest)
                    .build();

            return s3Presigner.presignGetObject(presignRequest).url().toString();
        } catch (Exception ex) {
            log.error("Failed to generate presigned S3 URL for key '{}': {}", key, ex.getMessage(), ex);
            throw new FileStorageException("Failed to generate presigned access URL", ex);
        }
    }

    public String getBucketName() {
        return bucketName;
    }
}
