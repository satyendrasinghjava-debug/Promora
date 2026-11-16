INSERT INTO roles (name, description) VALUES
 ('USER','Registered member'),('ADVERTISER','Can create and fund campaigns'),('PROMOTER','Can join campaigns and earn'),
 ('ADMIN','Platform staff'),('SUPER_ADMIN','Full platform control');

INSERT INTO permissions (name, description) VALUES
 ('admin.access','Open the admin application'),
 ('user.view','View users'),('user.manage','Verify, suspend and reactivate users'),('user.roles','Change account roles'),
 ('campaign.moderate','Approve, reject, pause and terminate campaigns'),
 ('verification.review','Decide business and creator verification'),
 ('finance.view','View transactions, commissions and payouts'),('finance.manage','Approve payouts, refunds and commissions'),
 ('referral.manage','Review referrals and rewards'),
 ('fraud.manage','Investigate risk flags'),
 ('content.moderate','Handle reports and takedowns'),
 ('report.view','View and export reports'),
 ('settings.manage','Change platform settings'),
 ('audit.view','View audit logs');

INSERT INTO role_permissions (role_name, permission_name)
 SELECT 'SUPER_ADMIN', name FROM permissions;
INSERT INTO role_permissions (role_name, permission_name)
 SELECT 'ADMIN', name FROM permissions WHERE name NOT IN ('user.roles','settings.manage','audit.view');

INSERT INTO campaign_categories (name, slug, description, icon, sort_order) VALUES
 ('Businesses & Startups','businesses-startups','Companies and new ventures looking for visibility','Building2',1),
 ('Products & Stores','products-stores','Physical and digital products, D2C and online stores','ShoppingBag',2),
 ('Apps & Websites','apps-websites','Mobile apps, SaaS tools and websites','Smartphone',3),
 ('Creators & Channels','creators-channels','YouTube channels, pages and personal brands','Video',4),
 ('Courses & Education','courses-education','Online courses, coaching and learning platforms','GraduationCap',5),
 ('Freelancers & Agencies','freelancers-agencies','Independent professionals and service agencies','Briefcase',6),
 ('Events & Communities','events-communities','Meetups, launches and online communities','CalendarDays',7),
 ('Local & Real Estate','local-real-estate','Local businesses, property and neighbourhood services','MapPin',8),
 ('Affiliate & Referral','affiliate-referral','Affiliate offers and referral campaigns','Link2',9);

-- Pricing below is an untested hypothesis, editable from the admin settings.
INSERT INTO subscription_plans (code, name, price_paise, max_active_campaigns, platform_fee_bps, features, highlighted, sort_order) VALUES
 ('FREE','Free',0,1,1500,'1 active campaign|Public listing|Basic performance stats',FALSE,1),
 ('STARTER','Starter',19900,3,1200,'3 active campaigns|Lower platform fee|CSV export',FALSE,2),
 ('GROWTH','Growth',49900,10,1000,'10 active campaigns|Advanced analytics|AI campaign assistant credits',TRUE,3),
 ('BUSINESS','Business',149900,1000,800,'Unlimited campaigns|Priority review|Team-ready reporting',FALSE,4);

INSERT INTO platform_settings (key, value, description) VALUES
 ('commission.platform_fee_bps','1500','Default platform fee on promoter rewards, in basis points'),
 ('commission.gst_bps','1800','GST applied to the platform fee, in basis points (confirm with an accountant)'),
 ('commission.hold_days','7','Days a commission stays pending before it can be paid out'),
 ('payout.minimum_paise','20000','Minimum payout request in paise'),
 ('campaign.min_budget_paise','50000','Minimum campaign budget in paise'),
 ('campaign.policy','Campaigns must be legal in India, truthful, and must not promote gambling, adult content, tobacco, alcohol, unlicensed financial or medical products, or fake engagement.','Campaign content policy shown to advertisers'),
 ('referral.reward_business_paise','5000','Promo credits for an approved business referral'),
 ('referral.reward_promoter_paise','2500','Promo credits for an approved promoter referral'),
 ('referral.max_rewards_per_month','10','Maximum rewarded referrals per referrer per calendar month'),
 ('tracking.max_clicks_per_ip_per_hour','20','Raw clicks from one IP on one campaign per hour before a risk flag is raised'),
 ('notification.template.campaign_approved','Your campaign "{title}" was approved.','Notification template'),
 ('notification.template.campaign_rejected','Your campaign "{title}" was not approved: {reason}','Notification template');
