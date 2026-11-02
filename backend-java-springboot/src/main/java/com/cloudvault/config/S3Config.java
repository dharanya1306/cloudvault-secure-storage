package com.cloudvault.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.net.URI;

@Slf4j
@Configuration
public class S3Config {

    @Value("${cloudvault.aws.access-key}")
    private String accessKey;

    @Value("${cloudvault.aws.secret-key}")
    private String secretKey;

    @Value("${cloudvault.aws.region}")
    private String region;

    @Value("${cloudvault.aws.s3.endpoint-override:}")
    private String endpointOverride;

    @Bean
    public AwsBasicCredentials awsBasicCredentials() {
        return AwsBasicCredentials.create(accessKey, secretKey);
    }

    @Bean
    public StaticCredentialsProvider staticCredentialsProvider(AwsBasicCredentials credentials) {
        return StaticCredentialsProvider.create(credentials);
    }

    @Bean
    public S3Client s3Client(StaticCredentialsProvider credentialsProvider) {
        S3ClientBuilder builder = S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(credentialsProvider);

        if (endpointOverride != null && !endpointOverride.isBlank()) {
            builder.endpointOverride(URI.create(endpointOverride));
            builder.forcePathStyle(true);
            log.info("S3Client configured with custom endpoint: {}", endpointOverride);
        } else {
            log.info("S3Client configured for AWS Region: {}", region);
        }

        return builder.build();
    }

    @Bean
    public S3Presigner s3Presigner(StaticCredentialsProvider credentialsProvider) {
        S3Presigner.Builder builder = S3Presigner.builder()
                .region(Region.of(region))
                .credentialsProvider(credentialsProvider);

        if (endpointOverride != null && !endpointOverride.isBlank()) {
            builder.endpointOverride(URI.create(endpointOverride));
        }

        log.info("S3Presigner bean initialized successfully.");
        return builder.build();
    }
}
