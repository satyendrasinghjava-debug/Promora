package com.promora.user;

import com.promora.advertiser.AdvertiserProfile;
import com.promora.advertiser.AdvertiserProfileRepository;
import com.promora.common.Sql;
import com.promora.promoter.PromoterProfile;
import com.promora.promoter.PromoterProfileRepository;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeSet;

@Service
public class UserService {
    private final UserProfileRepository profiles;
    private final AdvertiserProfileRepository advertisers;
    private final PromoterProfileRepository promoters;
    private final Sql sql;

    public UserService(UserProfileRepository profiles, AdvertiserProfileRepository advertisers, PromoterProfileRepository promoters, Sql sql) {
        this.profiles = profiles; this.advertisers = advertisers; this.promoters = promoters; this.sql = sql;
    }

    /** The account view returned to its owner. Never includes the password hash. */
    public Map<String, Object> describe(User u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("email", u.getEmail());
        m.put("fullName", u.getFullName());
        m.put("roles", new TreeSet<>(u.getRoles()));
        m.put("emailVerified", u.isEmailVerified());
        m.put("verifiedBadge", u.isVerifiedBadge());
        m.put("promoCreditsPaise", u.getPromoCreditsPaise());
        m.put("createdAt", u.getCreatedAt());
        if (u.isStaff())
            m.put("permissions", sql.list("SELECT DISTINCT permission_name FROM role_permissions WHERE role_name IN (:roles) ORDER BY 1", Map.of("roles", u.getRoles()))
                    .stream().map(r -> r.get("permissionName")).toList());
        UserProfile p = profiles.findById(u.getId()).orElse(null);
        m.put("profile", p);
        AdvertiserProfile a = advertisers.findByUserId(u.getId()).orElse(null);
        m.put("advertiserProfile", a);
        PromoterProfile pr = promoters.findByUserId(u.getId()).orElse(null);
        m.put("promoterProfile", pr);
        return m;
    }
}
