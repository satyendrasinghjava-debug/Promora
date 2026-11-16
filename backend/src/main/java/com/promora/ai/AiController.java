package com.promora.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.promora.common.ApiException;
import com.promora.config.PromoraProperties;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * Campaign assistant behind a provider-independent interface. The bundled implementation speaks the widely used
 * "chat completions" HTTP shape, so any compatible provider can be configured with AI_BASE_URL, AI_API_KEY and AI_MODEL.
 * When nothing is configured the feature reports itself as disabled; it never fabricates output.
 */
@RestController
@RequestMapping("/api/v1/ai")
@Tag(name = "AI assistant")
public class AiController {
    public interface AiProvider { String complete(String system, String prompt); }

    private static final Map<String, String> TASKS = Map.of(
            "DESCRIPTION", "Write a clear, honest campaign description of 80 to 120 words for promoters. No exaggerated claims.",
            "CAPTIONS", "Write three short social media captions a promoter could post. Each must start with the label 'Ad:'.",
            "AUDIENCE", "Suggest the three most relevant target audiences in India, one line each, with a reason.",
            "CATEGORY", "Recommend the single best-fitting marketplace category and explain why in one sentence.",
            "IMPROVE", "Rewrite the campaign copy to be clearer and more specific. Keep every factual claim unchanged.",
            "STRATEGY", "Suggest four practical, low-budget promotion ideas for creators sharing this campaign.");

    private final PromoraProperties.Ai config;
    private final AiProvider provider;

    public AiController(PromoraProperties props, RestClient.Builder builder) {
        this.config = props.ai();
        this.provider = config != null && config.configured() ? httpProvider(builder) : null;
    }

    private AiProvider httpProvider(RestClient.Builder builder) {
        RestClient client = builder.baseUrl(config.baseUrl()).defaultHeader("Authorization", "Bearer " + config.apiKey()).build();
        return (system, prompt) -> {
            JsonNode res = client.post().uri("/chat/completions").contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("model", config.model(), "max_tokens", 600, "messages", List.of(
                            Map.of("role", "system", "content", system), Map.of("role", "user", "content", prompt))))
                    .retrieve().body(JsonNode.class);
            String text = res == null ? null : res.path("choices").path(0).path("message").path("content").asText(null);
            if (text == null || text.isBlank()) throw new IllegalStateException("Empty AI response");
            return text.trim();
        };
    }

    @GetMapping("/status")
    public Map<String, Object> status() {
        return provider != null
                ? Map.of("enabled", true, "model", config.model())
                : Map.of("enabled", false, "message", "The AI assistant is not configured. Set AI_BASE_URL, AI_API_KEY and AI_MODEL on the server to enable it.");
    }

    public record AssistRequest(@NotBlank @Pattern(regexp = "DESCRIPTION|CAPTIONS|AUDIENCE|CATEGORY|IMPROVE|STRATEGY") String task,
                                @NotBlank @Size(max = 140) String title, @Size(max = 5000) String text) {}

    @PostMapping("/assist")
    public Map<String, Object> assist(@Valid @RequestBody AssistRequest req) {
        if (provider == null) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED", "The AI assistant is not configured on this server");
        try {
            String output = provider.complete("You are a marketing assistant for Promora, an Indian promotion marketplace. " + TASKS.get(req.task()),
                    "Campaign title: " + req.title() + "\n\nCampaign details: " + (req.text() == null ? "(none provided)" : req.text()));
            return Map.of("task", req.task(), "output", output, "generatedByAi", true);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI_PROVIDER_ERROR", "The AI provider did not return a result. Try again.");
        }
    }
}
