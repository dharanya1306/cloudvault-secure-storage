package com.cloudvault.controller;

import com.cloudvault.dto.ShareRequestDto;
import com.cloudvault.dto.ShareResponseDto;
import com.cloudvault.entity.User;
import com.cloudvault.service.FileService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@RestController
@RequiredArgsConstructor
public class ShareController {

    private final FileService fileService;

    @PostMapping("/api/files/share")
    public ResponseEntity<ShareResponseDto> createShareLink(
            @Valid @RequestBody ShareRequestDto request,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest servletRequest) {

        String clientIp = extractClientIp(servletRequest);
        ShareResponseDto response = fileService.shareFile(request, currentUser, clientIp);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/api/public/share/{token}")
    public ResponseEntity<byte[]> accessSharedFile(
            @PathVariable String token,
            HttpServletRequest servletRequest) {

        String clientIp = extractClientIp(servletRequest);
        FileService.DecryptedFile decryptedFile = fileService.getSharedFile(token, clientIp);

        String encodedFilename = URLEncoder.encode(decryptedFile.originalFilename(), StandardCharsets.UTF_8)
                .replaceAll("\\+", "%20");

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(decryptedFile.mimeType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + encodedFilename + "\"; filename*=UTF-8''" + encodedFilename)
                .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(decryptedFile.content().length))
                .header("X-Checksum-SHA256", decryptedFile.checksumSha256())
                .body(decryptedFile.content());
    }

    private String extractClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
