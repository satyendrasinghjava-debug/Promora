package com.promora.seo;

import com.promora.common.Sql;
import com.promora.config.PromoraProperties;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

import java.util.List;
import java.util.Map;

/**
 * Search and link-preview support for the client-rendered React app: a live sitemap, robots.txt, and a small
 * server-rendered HTML snapshot (title, description, Open Graph, JSON-LD) that a reverse proxy can serve to crawlers.
 */
@RestController
public class SeoController {
    private static final List<String> STATIC_PATHS = List.of("/", "/about", "/how-it-works", "/pricing", "/discover", "/campaigns", "/categories",
            "/creators", "/businesses", "/contact", "/faq", "/privacy-policy", "/terms", "/refund-policy");
    private final Sql sql;
    private final String base;

    public SeoController(Sql sql, PromoraProperties props) {
        this.sql = sql;
        this.base = props.publicUrl();
    }

    @GetMapping(value = "/robots.txt", produces = MediaType.TEXT_PLAIN_VALUE)
    public String robots() {
        return "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /dashboard\nDisallow: /api/\nDisallow: /r/\nSitemap: " + base + "/sitemap.xml\n";
    }

    @GetMapping(value = "/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public String sitemap() {
        StringBuilder sb = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");
        STATIC_PATHS.forEach(p -> sb.append("  <url><loc>").append(base).append(p).append("</loc></url>\n"));
        sql.list("SELECT id, updated_at FROM campaigns WHERE status = 'ACTIVE' ORDER BY updated_at DESC LIMIT 5000", Map.of())
                .forEach(r -> sb.append("  <url><loc>").append(base).append("/campaigns/").append(r.get("id")).append("</loc><lastmod>")
                        .append(String.valueOf(r.get("updatedAt")), 0, 10).append("</lastmod></url>\n"));
        sql.list("SELECT ad.slug FROM advertiser_profiles ad JOIN users u ON u.id = ad.user_id WHERE NOT ad.hidden AND u.status = 'ACTIVE' LIMIT 5000", Map.of())
                .forEach(r -> sb.append("  <url><loc>").append(base).append("/businesses/").append(r.get("slug")).append("</loc></url>\n"));
        sql.list("SELECT pr.slug FROM promoter_profiles pr JOIN users u ON u.id = pr.user_id WHERE NOT pr.hidden AND u.status = 'ACTIVE' LIMIT 5000", Map.of())
                .forEach(r -> sb.append("  <url><loc>").append(base).append("/creators/").append(r.get("slug")).append("</loc></url>\n"));
        return sb.append("</urlset>\n").toString();
    }

    @GetMapping(value = "/seo/render", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> render(@RequestParam String path) {
        String title = "Promora | One Platform. Infinite Possibilities.";
        String description = "Promora is a promotion marketplace connecting businesses, creators and audiences. Launch a campaign or earn by promoting.";
        String jsonLd = "{\"@context\":\"https://schema.org\",\"@type\":\"Organization\",\"name\":\"Promora\",\"url\":\"" + base + "\"}";
        Map<String, Object> row = null;
        String[] parts = path.split("/");
        try {
            if (parts.length == 3 && "campaigns".equals(parts[1]))
                row = sql.one("SELECT c.title AS name, left(c.description, 180) AS description FROM campaigns c WHERE c.status = 'ACTIVE' AND c.id = CAST(:v AS uuid)", Map.of("v", parts[2]));
            else if (parts.length == 3 && "businesses".equals(parts[1]))
                row = sql.one("SELECT business_name AS name, left(description, 180) AS description FROM advertiser_profiles WHERE slug = :v AND NOT hidden", Map.of("v", parts[2]));
            else if (parts.length == 3 && "creators".equals(parts[1]))
                row = sql.one("SELECT display_name AS name, left(bio, 180) AS description FROM promoter_profiles WHERE slug = :v AND NOT hidden", Map.of("v", parts[2]));
        } catch (Exception ignored) { /* malformed id: fall back to the default snapshot */ }
        if (parts.length == 3 && List.of("campaigns", "businesses", "creators").contains(parts[1]) && row == null)
            return ResponseEntity.status(404).body("<!doctype html><title>Not found | Promora</title><h1>Not found</h1>");
        if (row != null) {
            title = row.get("name") + " | Promora";
            if (row.get("description") != null) description = String.valueOf(row.get("description"));
        }
        String t = HtmlUtils.htmlEscape(title), d = HtmlUtils.htmlEscape(description), url = HtmlUtils.htmlEscape(base + path);
        String html = "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>" + t + "</title>"
                + "<meta name=\"description\" content=\"" + d + "\"><link rel=\"canonical\" href=\"" + url + "\">"
                + "<meta property=\"og:title\" content=\"" + t + "\"><meta property=\"og:description\" content=\"" + d + "\">"
                + "<meta property=\"og:url\" content=\"" + url + "\"><meta property=\"og:type\" content=\"website\">"
                + "<meta property=\"og:image\" content=\"" + HtmlUtils.htmlEscape(base) + "/assets/brand/og-default.svg\">"
                + "<script type=\"application/ld+json\">" + jsonLd.replace("</", "<\\/") + "</script></head>"
                + "<body><h1>" + t + "</h1><p>" + d + "</p><a href=\"" + url + "\">Open on Promora</a></body></html>";
        return ResponseEntity.ok(html);
    }
}
