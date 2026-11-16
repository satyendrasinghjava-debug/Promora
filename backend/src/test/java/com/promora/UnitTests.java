package com.promora;

import com.promora.analytics.ReportControllerTestAccess;
import com.promora.campaign.CampaignStatus;
import com.promora.common.ApiException;
import com.promora.common.Util;
import com.promora.config.PromoraProperties;
import com.promora.payment.RazorpayProvider;
import com.promora.payment.SandboxProvider;
import com.promora.tracking.TrackingService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UnitTests {

    @ParameterizedTest
    @CsvSource({"DRAFT,PENDING_REVIEW,true", "PENDING_REVIEW,APPROVED,true", "APPROVED,ACTIVE,true", "ACTIVE,PAUSED,true", "PAUSED,ACTIVE,true",
            "ACTIVE,COMPLETED,true", "DRAFT,APPROVED,false", "DRAFT,ACTIVE,false", "REJECTED,PENDING_REVIEW,false", "COMPLETED,ACTIVE,false",
            "TERMINATED,ACTIVE,false", "CANCELLED,DRAFT,false", "PENDING_REVIEW,ACTIVE,false", "ACTIVE,APPROVED,false"})
    void campaignStateMachine(String from, String to, boolean allowed) {
        assertThat(CampaignStatus.canTransition(from, to)).isEqualTo(allowed);
        if (!allowed) assertThatThrownBy(() -> CampaignStatus.require(from, to)).isInstanceOf(ApiException.class);
    }

    @Test
    void onlyDraftsAndChangeRequestsAreEditable() {
        assertThat(CampaignStatus.editable("DRAFT")).isTrue();
        assertThat(CampaignStatus.editable("CHANGES_REQUESTED")).isTrue();
        assertThat(CampaignStatus.editable("ACTIVE")).isFalse();
        assertThat(CampaignStatus.editable("PENDING_REVIEW")).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"curl/8.4.0", "Googlebot/2.1 (+http://www.google.com/bot.html)", "WhatsApp/2.23.20 A", "python-requests/2.31",
            "facebookexternalhit/1.1", "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0", "short", ""})
    void automatedClientsAreNotQualified(String ua) {
        assertThat(TrackingService.looksLikeBot(ua)).isTrue();
    }

    @Test
    void realBrowsersAreAccepted() {
        assertThat(TrackingService.looksLikeBot("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36")).isFalse();
        assertThat(TrackingService.looksLikeBot(null)).isTrue();
    }

    @Test
    void slugsTokensAndHashes() {
        assertThat(Util.slugify("  Kaveri Candle Co. — Festive Launch! ")).isEqualTo("kaveri-candle-co-festive-launch");
        assertThat(Util.slugify("!!!")).isEqualTo("item");
        assertThat(Util.randomToken(24)).hasSize(48).isNotEqualTo(Util.randomToken(24));
        assertThat(Util.sha256("abc")).isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        assertThat(Util.constantTimeEquals("a", null)).isFalse();
    }

    @Test
    void razorpaySignaturesFollowTheDocumentedHmacScheme() {
        RazorpayProvider p = new RazorpayProvider(new PromoraProperties.Razorpay("rzp_test_key", "secret123", "whsec"), RestClient.builder());
        String good = Util.hmacSha256Hex("secret123", "order_1|pay_1");
        assertThat(p.verifyPaymentSignature("order_1", "pay_1", good)).isTrue();
        assertThat(p.verifyPaymentSignature("order_1", "pay_2", good)).isFalse();
        assertThat(p.verifyPaymentSignature("order_1", "pay_1", null)).isFalse();
        assertThat(p.verifyWebhookSignature("{\"a\":1}", Util.hmacSha256Hex("whsec", "{\"a\":1}"))).isTrue();
        assertThat(p.verifyWebhookSignature("{\"a\":2}", Util.hmacSha256Hex("whsec", "{\"a\":1}"))).isFalse();
        assertThat(p.sandbox()).isFalse();
        assertThat(new SandboxProvider("s").sandbox()).isTrue();
        // Without a webhook secret every webhook is rejected
        assertThat(new RazorpayProvider(new PromoraProperties.Razorpay("k", "s", ""), RestClient.builder()).verifyWebhookSignature("x", Util.hmacSha256Hex("anything", "x"))).isFalse();
    }

    @Test
    void csvCellsAreQuotedAndFormulaSafe() {
        assertThat(ReportControllerTestAccess.cell("=HYPERLINK(\"http://evil\")")).startsWith("\"'=");
        assertThat(ReportControllerTestAccess.cell("He said \"hi\"")).isEqualTo("\"He said \"\"hi\"\"\"");
        assertThat(ReportControllerTestAccess.cell(42L)).isEqualTo("42");
        assertThat(ReportControllerTestAccess.cell(null)).isEmpty();
    }
}
