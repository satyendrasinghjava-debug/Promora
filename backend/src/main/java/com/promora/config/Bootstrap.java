package com.promora.config;

import com.promora.advertiser.AdvertiserProfile;
import com.promora.advertiser.AdvertiserProfileRepository;
import com.promora.campaign.*;
import com.promora.common.Util;
import com.promora.marketplace.CampaignApplication;
import com.promora.marketplace.CampaignApplicationRepository;
import com.promora.payment.Transaction;
import com.promora.payment.TransactionRepository;
import com.promora.promoter.PromoterProfile;
import com.promora.promoter.PromoterProfileRepository;
import com.promora.referral.ReferralService;
import com.promora.tracking.TrackingLink;
import com.promora.tracking.TrackingLinkRepository;
import com.promora.user.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/**
 * Start-up data. (1) Creates the first super admin from ADMIN_EMAIL / ADMIN_PASSWORD when no staff account exists;
 * there is no public way to register an admin. (2) In the dev profile only, loads clearly labelled demo data.
 */
@Component
public class Bootstrap implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(Bootstrap.class);
    public static final String DEMO_PASSWORD = "Promora@123";

    private final PromoraProperties props;
    private final UserRepository users;
    private final UserProfileRepository profiles;
    private final AdvertiserProfileRepository advertisers;
    private final PromoterProfileRepository promoters;
    private final CategoryRepository categories;
    private final CampaignRepository campaigns;
    private final CampaignAssetRepository assets;
    private final CampaignApplicationRepository applications;
    private final TrackingLinkRepository links;
    private final TransactionRepository transactions;
    private final ReferralService referrals;
    private final PasswordEncoder encoder;

    public Bootstrap(PromoraProperties props, UserRepository users, UserProfileRepository profiles, AdvertiserProfileRepository advertisers,
                     PromoterProfileRepository promoters, CategoryRepository categories, CampaignRepository campaigns, CampaignAssetRepository assets,
                     CampaignApplicationRepository applications, TrackingLinkRepository links, TransactionRepository transactions,
                     ReferralService referrals, PasswordEncoder encoder) {
        this.props = props; this.users = users; this.profiles = profiles; this.advertisers = advertisers; this.promoters = promoters;
        this.categories = categories; this.campaigns = campaigns; this.assets = assets; this.applications = applications; this.links = links;
        this.transactions = transactions; this.referrals = referrals; this.encoder = encoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        PromoraProperties.BootstrapAdmin admin = props.bootstrapAdmin();
        if (admin != null && admin.email() != null && !admin.email().isBlank() && admin.password() != null && admin.password().length() >= 12
                && users.findByEmail(admin.email()).isEmpty()) {
            user(admin.email(), admin.password(), "Platform Admin", Set.of("USER", "ADMIN", "SUPER_ADMIN"));
            log.info("Created bootstrap super admin {}", admin.email());
        }
        if (props.seedDemoData() && users.findByEmail("admin@promora.dev").isEmpty()) seedDemo();
    }

    private User user(String email, String password, String name, Set<String> roles) {
        User u = new User();
        u.setEmail(email.toLowerCase());
        u.setPasswordHash(encoder.encode(password));
        u.setFullName(name);
        u.setEmailVerified(true);
        u.getRoles().addAll(roles);
        users.save(u);
        UserProfile p = new UserProfile();
        p.setUserId(u.getId());
        p.setTermsAcceptedAt(Instant.now());
        p.setCity("Bengaluru");
        p.setPhone("+91 90000 00000");
        p.setProfileCompleted(true);
        profiles.save(p);
        referrals.ensureCode(u.getId());
        return u;
    }

    private AdvertiserProfile business(User u, String name, String categorySlug, String description, String city) {
        AdvertiserProfile a = new AdvertiserProfile();
        a.setUserId(u.getId());
        a.setBusinessName(name);
        a.setSlug(Util.slugify(name));
        a.setCategoryId(categories.findBySlug(categorySlug).map(Category::getId).orElse(null));
        a.setDescription(description);
        a.setWebsite("https://example.com");
        a.setCity(city);
        a.setVerificationStatus("VERIFIED");
        return advertisers.save(a);
    }

    private Campaign campaign(AdvertiserProfile a, String title, String categorySlug, String objective, String type, long reward, long budget,
                              String status, boolean featured, String mode, String description) {
        Campaign c = new Campaign();
        c.setAdvertiserId(a.getId());
        c.setOwnerUserId(a.getUserId());
        c.setTitle(title);
        c.setSlug(Util.slugify(title));
        c.setDescription(description + " (Development demo data.)");
        c.setCategoryId(categories.findBySlug(categorySlug).map(Category::getId).orElse(null));
        c.setObjective(objective);
        c.setTargetAudience("Adults 18 to 40 in Indian metro and tier-2 cities who shop or learn online.");
        c.setGeography("India");
        c.setLandingUrl("CPC".equals(type) ? "https://example.com/?campaign=" + Util.slugify(title) : null);
        c.setRewardType(type);
        c.setRewardPaise(reward);
        c.setBudgetPaise(budget);
        c.setStartDate(LocalDate.now().minusDays(2));
        c.setEndDate(LocalDate.now().plusDays(28));
        c.setApplicationMode(mode);
        c.setPromoInstructions("Share the link with a short honest recommendation. Do not use paid ads, incentivised clicks or misleading claims.");
        c.setDisclosureText("Label every post as an Ad at the start of the caption.");
        c.setStatus(status);
        c.setFeatured(featured);
        if (!"DRAFT".equals(status)) c.setSubmittedAt(Instant.now());
        boolean live = "ACTIVE".equals(status);
        if (live) { c.setApprovedAt(Instant.now()); c.setFundedPaise(budget); }
        campaigns.save(c);
        CampaignAsset asset = new CampaignAsset();
        asset.setCampaignId(c.getId());
        asset.setUrl("/assets/categories/" + categorySlug + ".svg");
        asset.setAltText(title);
        assets.save(asset);
        if (live) {
            Transaction t = new Transaction();
            t.setUserId(a.getUserId());
            t.setCampaignId(c.getId());
            t.setType("CAMPAIGN_FUNDING");
            t.setBasePaise(budget);
            t.setFeePaise(Math.round(budget * 0.15));
            t.setTaxPaise(Math.round(budget * 0.15 * 0.18));
            t.setAmountPaise(t.getBasePaise() + t.getFeePaise() + t.getTaxPaise());
            t.setStatus("PAID");
            t.setProvider("sandbox");
            t.setProviderOrderId("sandbox_order_seed_" + Util.randomToken(6));
            t.setProviderPaymentId("sandbox_pay_seed_" + Util.randomToken(6));
            t.setIdempotencyKey("seed-" + c.getId());
            t.setDescription("Demo seed funding (sandbox, no real money): " + title);
            transactions.save(t);
        }
        return c;
    }

    private void seedDemo() {
        user("admin@promora.dev", DEMO_PASSWORD, "Demo Admin", Set.of("USER", "ADMIN", "SUPER_ADMIN"));
        User adv = user("advertiser@promora.dev", DEMO_PASSWORD, "Riya Menon (demo)", Set.of("USER", "ADVERTISER"));
        User adv2 = user("academy@promora.dev", DEMO_PASSWORD, "Kabir Shah (demo)", Set.of("USER", "ADVERTISER"));
        User pro = user("promoter@promora.dev", DEMO_PASSWORD, "Arjun Rao (demo)", Set.of("USER", "PROMOTER"));

        AdvertiserProfile candles = business(adv, "Kaveri Candle Co. (demo)", "products-stores",
                "Hand-poured soy candles made in small batches. This business profile is development demo data.", "Bengaluru");
        AdvertiserProfile academy = business(adv2, "SkillNest Academy (demo)", "courses-education",
                "Weekend cohort courses in design and data. This business profile is development demo data.", "Pune");

        PromoterProfile p = new PromoterProfile();
        p.setUserId(pro.getId());
        p.setDisplayName("Arjun Reviews (demo)");
        p.setSlug("arjun-reviews-demo");
        p.setBio("Honest reviews of home, lifestyle and learning products. This creator profile is development demo data.");
        p.setAudienceSize(12500);
        p.setAudienceDescription("Mostly 22 to 34 year olds in Bengaluru, Hyderabad and Pune.");
        p.setInterests("Home, Lifestyle, Education");
        p.setLanguages("English, Hindi, Kannada");
        p.setInstagramUrl("https://instagram.com/example");
        p.setYoutubeUrl("https://youtube.com/@example");
        p.setUpiId("arjun.demo@upi");
        p.setVerificationStatus("VERIFIED");
        promoters.save(p);

        Campaign c1 = campaign(candles, "Festive soy candle collection launch", "products-stores", "WEBSITE_VISITS", "CPC", 500, 200000, "ACTIVE", true, "OPEN",
                "Help us introduce our festive collection of hand-poured soy candles. We pay for every verified visitor you send to the collection page.");
        campaign(candles, "Candle-making workshop sign-ups", "events-communities", "LEADS", "CPL", 4000, 400000, "ACTIVE", false, "APPROVAL",
                "We run a monthly candle-making workshop in Bengaluru. Earn for every genuine enquiry submitted through your link.");
        campaign(academy, "UX design weekend cohort", "courses-education", "LEADS", "CPL", 6000, 600000, "ACTIVE", true, "APPROVAL",
                "A six-week weekend cohort for working professionals moving into UX design. Earn per verified enquiry from interested learners.");
        campaign(academy, "Free data analytics masterclass", "courses-education", "WEBSITE_VISITS", "CPC", 300, 150000, "ACTIVE", false, "OPEN",
                "Promote our free 90-minute data analytics masterclass. We reward every verified visit to the registration page.");
        campaign(academy, "SkillNest learner community app", "apps-websites", "APP_INSTALLS", "CPC", 400, 100000, "PENDING_REVIEW", false, "OPEN",
                "Our new community app helps learners find study partners. This campaign is waiting for moderation.");
        campaign(candles, "Corporate gifting catalogue", "businesses-startups", "LEADS", "CPL", 8000, 800000, "DRAFT", false, "APPROVAL",
                "Draft campaign for our corporate gifting catalogue.");

        CampaignApplication app = new CampaignApplication();
        app.setCampaignId(c1.getId());
        app.setPromoterId(p.getId());
        app.setUserId(pro.getId());
        app.setPitch("My audience loves home decor; I can feature this in a reel and my weekly story round-up.");
        app.setStatus("APPROVED");
        app.setDecidedAt(Instant.now());
        applications.save(app);
        TrackingLink link = new TrackingLink();
        link.setApplicationId(app.getId());
        link.setCampaignId(c1.getId());
        link.setPromoterUserId(pro.getId());
        link.setCode("demoLink1");
        links.save(link);
        log.info("Seeded development demo data. Demo accounts (password {}): {}", DEMO_PASSWORD,
                List.of("admin@promora.dev", "advertiser@promora.dev", "academy@promora.dev", "promoter@promora.dev"));
    }
}
