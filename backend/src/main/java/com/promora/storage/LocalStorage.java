package com.promora.storage;

import com.promora.common.ApiException;
import com.promora.common.Util;
import com.promora.config.PromoraProperties;
import com.promora.security.Current;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

public class LocalStorage {

    @Service
    public static class LocalStorageService implements StorageService {
        private final Path dir;

        public LocalStorageService(PromoraProperties props) throws IOException {
            this.dir = Path.of(props.storage().localDir()).toAbsolutePath().normalize();
            Files.createDirectories(dir);
        }
        public Path dir() { return dir; }

        @Override
        public String store(byte[] content, String extension, String contentType) {
            // The file name is generated on the server; nothing from the upload's own name is used.
            String name = Util.randomToken(16) + "." + extension;
            try { Files.write(dir.resolve(name), content); } catch (IOException e) { throw new IllegalStateException("Could not store file", e); }
            return "/files/" + name;
        }
    }

    @Configuration
    public static class FilesWebConfig implements WebMvcConfigurer {
        private final LocalStorageService storage;
        public FilesWebConfig(LocalStorageService storage) { this.storage = storage; }

        @Override
        public void addResourceHandlers(ResourceHandlerRegistry registry) {
            registry.addResourceHandler("/files/**").addResourceLocations(storage.dir().toUri().toString()).setCachePeriod(86400);
        }
    }

    @RestController
    @RequestMapping("/api/v1/uploads")
    @Tag(name = "Uploads")
    public static class UploadController {
        private final StorageService storage;
        public UploadController(StorageService storage) { this.storage = storage; }

        /** Accepts PNG, JPEG and WebP images up to 5 MB. The type is decided from the file's leading bytes, not its name or header. */
        @PostMapping("/images")
        @ResponseStatus(HttpStatus.CREATED)
        public Map<String, Object> upload(@RequestParam("file") MultipartFile file) throws IOException {
            Current.user();
            if (file.isEmpty()) throw ApiException.badRequest("EMPTY_FILE", "Choose an image to upload");
            byte[] b = file.getBytes();
            String ext = detect(b);
            if (ext == null) throw ApiException.unprocessable("UNSUPPORTED_FILE", "Only PNG, JPEG and WebP images are accepted");
            return Map.of("url", storage.store(b, ext, "image/" + ext));
        }

        static String detect(byte[] b) {
            if (b.length > 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return "png";
            if (b.length > 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return "jpg";
            if (b.length > 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "webp";
            return null;
        }
    }
}
