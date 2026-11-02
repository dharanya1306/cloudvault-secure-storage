package com.cloudvault.service;

import com.cloudvault.config.JwtTokenProvider;
import com.cloudvault.dto.AuthRequest;
import com.cloudvault.dto.AuthResponse;
import com.cloudvault.dto.RegisterRequest;
import com.cloudvault.entity.ActionType;
import com.cloudvault.entity.Role;
import com.cloudvault.entity.User;
import com.cloudvault.exception.AccessDeniedException;
import com.cloudvault.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuditService auditService;

    @Value("${cloudvault.storage.default-quota-bytes:1073741824}")
    private Long defaultQuotaBytes;

    @Transactional
    public AuthResponse register(RegisterRequest request, String ipAddress) {
        if (userRepository.existsByUsername(request.getUsername().trim())) {
            throw new IllegalArgumentException("Username '" + request.getUsername() + "' is already taken");
        }
        if (userRepository.existsByEmail(request.getEmail().trim().toLowerCase())) {
            throw new IllegalArgumentException("Email '" + request.getEmail() + "' is already registered");
        }

        User user = User.builder()
                .username(request.getUsername().trim())
                .email(request.getEmail().trim().toLowerCase())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(Role.ROLE_USER)
                .storageQuotaBytes(defaultQuotaBytes)
                .usedStorageBytes(0L)
                .build();

        User savedUser = userRepository.save(user);

        // Audit register
        auditService.logActionAsync(
                savedUser.getId(),
                ActionType.LOGIN,
                null,
                ipAddress,
                "User account successfully registered and activated"
        );

        String token = jwtTokenProvider.generateToken(savedUser);

        return AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .expiresInMs(jwtTokenProvider.getExpirationMs())
                .userId(savedUser.getId())
                .username(savedUser.getUsername())
                .email(savedUser.getEmail())
                .role(savedUser.getRole().name())
                .storageQuotaBytes(savedUser.getStorageQuotaBytes())
                .usedStorageBytes(savedUser.getUsedStorageBytes())
                .build();
    }

    @Transactional(readOnly = true)
    public AuthResponse login(AuthRequest request, String ipAddress) {
        String identifier = request.getUsername().trim();
        User user = userRepository.findByUsername(identifier)
                .or(() -> userRepository.findByEmail(identifier.toLowerCase()))
                .orElse(null);

        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            // Log security failure
            auditService.logActionAsync(
                    user != null ? user.getId() : null,
                    ActionType.ACCESS_DENIED,
                    null,
                    ipAddress,
                    "Failed authentication attempt for username/email: " + identifier
            );
            throw new BadCredentialsException("Invalid username or password");
        }

        // Audit successful login
        auditService.logActionAsync(
                user.getId(),
                ActionType.LOGIN,
                null,
                ipAddress,
                "User logged in successfully"
        );

        String token = jwtTokenProvider.generateToken(user);

        return AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .expiresInMs(jwtTokenProvider.getExpirationMs())
                .userId(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .role(user.getRole().name())
                .storageQuotaBytes(user.getStorageQuotaBytes())
                .usedStorageBytes(user.getUsedStorageBytes())
                .build();
    }
}
