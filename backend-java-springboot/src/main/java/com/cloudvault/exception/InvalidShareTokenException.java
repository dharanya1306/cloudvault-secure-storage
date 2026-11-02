package com.cloudvault.exception;

public class InvalidShareTokenException extends RuntimeException {
    public InvalidShareTokenException(String message) {
        super(message);
    }
}
