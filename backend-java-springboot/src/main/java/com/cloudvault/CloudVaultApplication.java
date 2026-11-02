package com.cloudvault;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * CloudVault - Secure Cloud File Storage and Access Management System
 * Production-Grade Spring Boot 3 Backend
 */
@SpringBootApplication
@EnableJpaAuditing
@EnableAsync
public class CloudVaultApplication {

    public static void main(String[] args) {
        SpringApplication.run(CloudVaultApplication.class, args);
    }
}
