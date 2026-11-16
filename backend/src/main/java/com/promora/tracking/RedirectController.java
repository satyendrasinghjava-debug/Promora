package com.promora.tracking;

import com.promora.common.ApiException;
import com.promora.common.Util;
import com.promora.config.PromoraProperties;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Tracking")
public class RedirectController {
    private final TrackingService tracking;
    private final PromoraProperties props;

    public RedirectController(TrackingService tracking, PromoraProperties props) {
        this.tracking = tracking;
        this.props = props;
    }

    @GetMapping("/r/{code}")
    public ResponseEntity<Void> redirect(@PathVariable String code, @RequestParam(required = false, name = "src") String source, HttpServletRequest request) {
        String target;
        try {
            target = tracking.handleClick(code, Util.clientIp(request), request.getHeader("User-Agent"), request.getHeader("Referer"), source).redirectUrl();
        } catch (ApiException e) {
            target = props.publicUrl() + "/campaigns";
        }
        return ResponseEntity.status(HttpStatus.FOUND).header(HttpHeaders.LOCATION, target)
                .header(HttpHeaders.CACHE_CONTROL, "no-store").header("X-Robots-Tag", "noindex, nofollow").build();
    }
}
