package com.cloudvault.controller;

import com.cloudvault.dto.FileResponseDto;
import com.cloudvault.dto.FileStatsResponse;
import com.cloudvault.entity.User;
import com.cloudvault.service.FileService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final FileService fileService;

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<FileResponseDto> uploadFile(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest servletRequest) throws IOException {

        String clientIp = extractClientIp(servletRequest);
        FileResponseDto response = fileService.uploadFile(file, currentUser, clientIp);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/my-files")
    public ResponseEntity<List<FileResponseDto>> getMyFiles(@AuthenticationPrincipal User currentUser) {
        List<FileResponseDto> files = fileService.getUserFiles(currentUser);
        return ResponseEntity.ok(files);
    }

    @GetMapping("/download/{id}")
    public ResponseEntity<byte[]> downloadFile(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest servletRequest) {

        String clientIp = extractClientIp(servletRequest);
        FileService.DecryptedFile decryptedFile = fileService.downloadFile(id, currentUser, clientIp);

        String encodedFilename = URLEncoder.encode(decryptedFile.originalFilename(), StandardCharsets.UTF_8)
                .replaceAll("\\+", "%20");

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(decryptedFile.mimeType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + encodedFilename + "\"; filename*=UTF-8''" + encodedFilename)
                .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(decryptedFile.content().length))
                .header("X-Checksum-SHA256", decryptedFile.checksumSha256())
                .body(decryptedFile.content());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteFile(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest servletRequest) {

        String clientIp = extractClientIp(servletRequest);
        fileService.deleteFile(id, currentUser, clientIp);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "File successfully deleted and storage reclaimed",
                "fileId", id
        ));
    }

    @GetMapping("/stats")
    public ResponseEntity<FileStatsResponse> getStorageStats(@AuthenticationPrincipal User currentUser) {
        FileStatsResponse stats = fileService.getStorageStats(currentUser);
        return ResponseEntity.ok(stats);
    }

    private String extractClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
