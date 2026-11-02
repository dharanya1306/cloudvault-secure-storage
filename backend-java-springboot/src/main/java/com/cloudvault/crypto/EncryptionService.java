package com.cloudvault.crypto;

import com.cloudvault.exception.FileStorageException;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Production-grade cryptographic service providing AES/GCM/NoPadding encryption and decryption.
 *
 * Algorithm Specifications:
 * - Cipher: AES/GCM/NoPadding
 * - Key Length: 256 bits (32 bytes)
 * - Authentication Tag Length: 128 bits (16 bytes)
 * - Initialization Vector (IV): 12 bytes generated per encryption via cryptographically strong SecureRandom
 * - Output format: [12-byte IV] + [Ciphertext + 16-byte Auth Tag]
 */
@Slf4j
@Service
public class EncryptionService {

    private static final String ALGORITHM = "AES";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH_BITS = 128;
    private static final int IV_LENGTH_BYTES = 12;

    @Value("${cloudvault.security.aes.secret-key}")
    private String base64SecretKey;

    private SecretKey secretKey;
    private final SecureRandom secureRandom = new SecureRandom();

    @PostConstruct
    public void init() {
        if (base64SecretKey == null || base64SecretKey.isBlank()) {
            throw new IllegalStateException("AES secret key is missing. Please configure cloudvault.security.aes.secret-key");
        }
        byte[] decodedKey = Base64.getDecoder().decode(base64SecretKey.trim());
        if (decodedKey.length != 32) {
            throw new IllegalStateException("Invalid AES key length: expected 256 bits (32 bytes), but got " + (decodedKey.length * 8) + " bits");
        }
        this.secretKey = new SecretKeySpec(decodedKey, ALGORITHM);
        log.info("EncryptionService initialized successfully with AES-256-GCM.");
    }

    /**
     * Encrypts plaintext data using AES/GCM/NoPadding.
     * Generates a unique 12-byte IV for every encryption call.
     * Prepends the 12-byte IV to the ciphertext payload.
     *
     * @param data Plaintext raw bytes
     * @return Combined byte array: [12-byte IV] + [Ciphertext with 16-byte GCM Tag]
     */
    public byte[] encrypt(byte[] data) {
        if (data == null) {
            throw new IllegalArgumentException("Payload to encrypt cannot be null");
        }
        try {
            // 1. Generate 12-byte secure random IV
            byte[] iv = new byte[IV_LENGTH_BYTES];
            secureRandom.nextBytes(iv);

            // 2. Initialize Cipher in ENCRYPT_MODE with GCMParameterSpec
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, parameterSpec);

            // 3. Encrypt data
            byte[] ciphertext = cipher.doFinal(data);

            // 4. Prepend 12-byte IV to the ciphertext
            byte[] combined = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(ciphertext, 0, combined, iv.length, ciphertext.length);

            return combined;
        } catch (Exception ex) {
            log.error("Failed to encrypt data with AES-256-GCM: {}", ex.getMessage(), ex);
            throw new FileStorageException("Cryptographic failure: unable to encrypt file payload", ex);
        }
    }

    /**
     * Decrypts combined IV + ciphertext using AES/GCM/NoPadding.
     * Extracts the first 12 bytes as IV and authenticates/decrypts the remaining ciphertext.
     *
     * @param dataWithIv Combined byte array: [12-byte IV] + [Ciphertext with 16-byte GCM Tag]
     * @return Original decrypted plaintext byte array
     */
    public byte[] decrypt(byte[] dataWithIv) {
        if (dataWithIv == null || dataWithIv.length < (IV_LENGTH_BYTES + (GCM_TAG_LENGTH_BITS / 8))) {
            throw new IllegalArgumentException("Invalid encrypted payload: insufficient bytes for IV and GCM authentication tag");
        }
        try {
            // 1. Extract 12-byte IV
            byte[] iv = new byte[IV_LENGTH_BYTES];
            System.arraycopy(dataWithIv, 0, iv, 0, IV_LENGTH_BYTES);

            // 2. Extract remaining ciphertext
            int ciphertextLength = dataWithIv.length - IV_LENGTH_BYTES;
            byte[] ciphertext = new byte[ciphertextLength];
            System.arraycopy(dataWithIv, IV_LENGTH_BYTES, ciphertext, 0, ciphertextLength);

            // 3. Initialize Cipher in DECRYPT_MODE
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, parameterSpec);

            // 4. Decrypt and verify authentication tag integrity
            return cipher.doFinal(ciphertext);
        } catch (Exception ex) {
            log.error("Failed to decrypt data or authentication tag verification failed: {}", ex.getMessage(), ex);
            throw new FileStorageException("Cryptographic failure: file integrity compromised or invalid decryption key", ex);
        }
    }
}
