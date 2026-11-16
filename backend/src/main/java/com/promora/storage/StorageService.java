package com.promora.storage;

/** Object storage abstraction. The bundled implementation writes to the local disk; an S3-compatible one can replace it. */
public interface StorageService {
    /** Stores the bytes and returns the public URL path of the stored object. */
    String store(byte[] content, String extension, String contentType);
}
