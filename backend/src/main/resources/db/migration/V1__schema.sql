-- Promora core schema. Money is stored in integer paise (1 INR = 100 paise).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE roles (name VARCHAR(40) PRIMARY KEY, description VARCHAR(255) NOT NULL);
CREATE TABLE permissions (name VARCHAR(60) PRIMARY KEY, description VARCHAR(255) NOT NULL);
CREATE TABLE role_permissions (
  role_name VARCHAR(40) NOT NULL REFERENCES roles(name) ON DELETE CASCADE,
  permission_name VARCHAR(60) NOT NULL REFERENCES permissions(name) ON DELETE CASCADE,
  PRIMARY KEY (role_name, permission_name));

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED')),
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_badge BOOLEAN NOT NULL DEFAULT FALSE,
  promo_credits_paise BIGINT NOT NULL DEFAULT 0 CHECK (promo_credits_paise >= 0),
  token_version INT NOT NULL DEFAULT 0,
  signup_ip_hash VARCHAR(64),
  utm_source VARCHAR(100), utm_medium VARCHAR(100), utm_campaign VARCHAR(100),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE UNIQUE INDEX ux_users_email ON users (lower(email));
CREATE INDEX ix_users_created ON users (created_at DESC);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_name VARCHAR(40) NOT NULL REFERENCES roles(name),
  PRIMARY KEY (user_id, role_name));

CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  phone VARCHAR(20), city VARCHAR(80), state VARCHAR(80), country VARCHAR(2) NOT NULL DEFAULT 'IN',
  bio VARCHAR(1000), avatar_url VARCHAR(500),
  marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
  terms_accepted_at TIMESTAMPTZ,
  profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX ix_refresh_user ON refresh_tokens (user_id);

CREATE TABLE auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('EMAIL_VERIFY','PASSWORD_RESET')),
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE campaign_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(80) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(300),
  icon VARCHAR(40) NOT NULL DEFAULT 'Tag',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0);

CREATE TABLE advertiser_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  business_name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  category_id UUID REFERENCES campaign_categories(id),
  website VARCHAR(300), description VARCHAR(2000), logo_url VARCHAR(500), city VARCHAR(80),
  verification_status VARCHAR(20) NOT NULL DEFAULT 'NONE' CHECK (verification_status IN ('NONE','PENDING','VERIFIED','REJECTED')),
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE promoter_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  bio VARCHAR(2000),
  audience_size INT NOT NULL DEFAULT 0 CHECK (audience_size >= 0),
  audience_description VARCHAR(1000),
  interests VARCHAR(500), languages VARCHAR(200),
  instagram_url VARCHAR(300), youtube_url VARCHAR(300), linkedin_url VARCHAR(300), website_url VARCHAR(300),
  upi_id VARCHAR(100),
  verification_status VARCHAR(20) NOT NULL DEFAULT 'NONE' CHECK (verification_status IN ('NONE','PENDING','VERIFIED','REJECTED')),
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID NOT NULL REFERENCES advertiser_profiles(id),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(140) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  description VARCHAR(5000) NOT NULL,
  category_id UUID REFERENCES campaign_categories(id),
  objective VARCHAR(30) NOT NULL DEFAULT 'WEBSITE_VISITS',
  target_audience VARCHAR(1000),
  geography VARCHAR(300) NOT NULL DEFAULT 'India',
  landing_url VARCHAR(500),
  reward_type VARCHAR(10) NOT NULL DEFAULT 'CPC' CHECK (reward_type IN ('CPC','CPL')),
  reward_paise BIGINT NOT NULL DEFAULT 0 CHECK (reward_paise >= 0),
  budget_paise BIGINT NOT NULL DEFAULT 0 CHECK (budget_paise >= 0),
  funded_paise BIGINT NOT NULL DEFAULT 0 CHECK (funded_paise >= 0),
  spent_paise BIGINT NOT NULL DEFAULT 0 CHECK (spent_paise >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  start_date DATE, end_date DATE,
  application_mode VARCHAR(10) NOT NULL DEFAULT 'APPROVAL' CHECK (application_mode IN ('OPEN','APPROVAL')),
  promo_instructions VARCHAR(2000),
  disclosure_text VARCHAR(300),
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN
    ('DRAFT','PENDING_REVIEW','CHANGES_REQUESTED','APPROVED','ACTIVE','PAUSED','COMPLETED','CANCELLED','REJECTED','TERMINATED')),
  review_note VARCHAR(1000),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMPTZ, approved_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_campaign_spend CHECK (spent_paise <= funded_paise),
  CONSTRAINT ck_campaign_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date));
CREATE INDEX ix_campaigns_status ON campaigns (status, created_at DESC);
CREATE INDEX ix_campaigns_owner ON campaigns (owner_user_id, created_at DESC);
CREATE INDEX ix_campaigns_category ON campaigns (category_id);
CREATE INDEX ix_campaigns_search ON campaigns USING GIN (to_tsvector('simple', title || ' ' || description));

CREATE TABLE campaign_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL, kind VARCHAR(10) NOT NULL DEFAULT 'IMAGE', alt_text VARCHAR(200),
  sort_order INT NOT NULL DEFAULT 0);
CREATE INDEX ix_assets_campaign ON campaign_assets (campaign_id);

CREATE TABLE campaign_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  promoter_id UUID NOT NULL REFERENCES promoter_profiles(id),
  user_id UUID NOT NULL REFERENCES users(id),
  pitch VARCHAR(1000),
  status VARCHAR(12) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','WITHDRAWN','REMOVED')),
  decision_note VARCHAR(500), decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, promoter_id));
CREATE INDEX ix_applications_user ON campaign_applications (user_id, created_at DESC);

CREATE TABLE tracking_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES campaign_applications(id),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  promoter_user_id UUID NOT NULL REFERENCES users(id),
  code VARCHAR(16) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE click_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_link_id UUID NOT NULL REFERENCES tracking_links(id),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  promoter_user_id UUID NOT NULL REFERENCES users(id),
  visitor_hash VARCHAR(64) NOT NULL,
  ip_hash VARCHAR(64) NOT NULL,
  user_agent VARCHAR(400), referer VARCHAR(500),
  source VARCHAR(100),
  click_day DATE NOT NULL,
  qualified BOOLEAN NOT NULL DEFAULT FALSE,
  reject_reason VARCHAR(40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
-- One qualified click per visitor, per campaign, per day: refreshes can never be paid twice.
CREATE UNIQUE INDEX ux_click_qualified ON click_events (campaign_id, visitor_hash, click_day) WHERE qualified;
CREATE INDEX ix_click_campaign ON click_events (campaign_id, created_at);
CREATE INDEX ix_click_promoter ON click_events (promoter_user_id, created_at);
CREATE INDEX ix_click_ip ON click_events (ip_hash, created_at);

CREATE TABLE conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  tracking_link_id UUID NOT NULL REFERENCES tracking_links(id),
  promoter_user_id UUID NOT NULL REFERENCES users(id),
  click_event_id UUID REFERENCES click_events(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('QUALIFIED_CLICK','LEAD')),
  dedupe_key VARCHAR(120) NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'VERIFIED' CHECK (status IN ('VERIFIED','REJECTED','REVERSED')),
  lead_name VARCHAR(120), lead_email VARCHAR(254), lead_phone VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, dedupe_key));
CREATE INDEX ix_conv_promoter ON conversion_events (promoter_user_id, created_at);

CREATE TABLE payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promoter_user_id UUID NOT NULL REFERENCES users(id),
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  upi_id VARCHAR(100) NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','APPROVED','PAID','REJECTED')),
  idempotency_key VARCHAR(80) NOT NULL,
  admin_note VARCHAR(500), paid_reference VARCHAR(120),
  decided_by UUID REFERENCES users(id), decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (promoter_user_id, idempotency_key));
CREATE INDEX ix_payout_status ON payout_requests (status, created_at);

CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversion_event_id UUID NOT NULL UNIQUE REFERENCES conversion_events(id),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  promoter_user_id UUID NOT NULL REFERENCES users(id),
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  platform_fee_paise BIGINT NOT NULL DEFAULT 0 CHECK (platform_fee_paise >= 0),
  status VARCHAR(12) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','PAID','REVERSED')),
  hold_until TIMESTAMPTZ NOT NULL,
  payout_request_id UUID REFERENCES payout_requests(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX ix_comm_promoter ON commissions (promoter_user_id, status);
CREATE INDEX ix_comm_hold ON commissions (status, hold_until);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  campaign_id UUID REFERENCES campaigns(id),
  type VARCHAR(24) NOT NULL CHECK (type IN ('CAMPAIGN_FUNDING','SUBSCRIPTION','REFUND','PAYOUT')),
  amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0),
  base_paise BIGINT NOT NULL DEFAULT 0,
  credit_paise BIGINT NOT NULL DEFAULT 0,
  fee_paise BIGINT NOT NULL DEFAULT 0,
  tax_paise BIGINT NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(12) NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED','PAID','FAILED','REFUNDED')),
  provider VARCHAR(20) NOT NULL,
  provider_order_id VARCHAR(80) UNIQUE,
  provider_payment_id VARCHAR(80) UNIQUE,
  idempotency_key VARCHAR(80) NOT NULL,
  reference_id UUID,
  description VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key));
CREATE INDEX ix_tx_user ON transactions (user_id, created_at DESC);
CREATE INDEX ix_tx_status ON transactions (status, created_at DESC);

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(20) NOT NULL, event_id VARCHAR(120) NOT NULL,
  event_type VARCHAR(60), payload TEXT, processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id));

CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL UNIQUE, name VARCHAR(60) NOT NULL,
  price_paise BIGINT NOT NULL CHECK (price_paise >= 0),
  period VARCHAR(10) NOT NULL DEFAULT 'MONTHLY',
  max_active_campaigns INT NOT NULL DEFAULT 1,
  platform_fee_bps INT NOT NULL DEFAULT 1500,
  features VARCHAR(1000) NOT NULL DEFAULT '',
  highlighted BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE, sort_order INT NOT NULL DEFAULT 0);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status VARCHAR(12) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','EXPIRED','CANCELLED')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL,
  transaction_id UUID UNIQUE REFERENCES transactions(id));
CREATE INDEX ix_sub_user ON subscriptions (user_id, status);

CREATE TABLE referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(16) NOT NULL UNIQUE);

CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES users(id),
  referred_user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  code VARCHAR(16) NOT NULL,
  referred_type VARCHAR(12),
  status VARCHAR(12) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVATED','REJECTED')),
  suspicious BOOLEAN NOT NULL DEFAULT FALSE, suspicious_reason VARCHAR(200),
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_no_self_referral CHECK (referrer_user_id <> referred_user_id));
CREATE INDEX ix_referrals_referrer ON referrals (referrer_user_id, created_at DESC);

CREATE TABLE referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL UNIQUE REFERENCES referrals(id),
  beneficiary_user_id UUID NOT NULL REFERENCES users(id),
  amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0),
  reward_type VARCHAR(20) NOT NULL DEFAULT 'PROMO_CREDIT',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('PENDING_APPROVAL','APPROVED','REJECTED')),
  note VARCHAR(300), decided_by UUID REFERENCES users(id), decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL, title VARCHAR(160) NOT NULL, body VARCHAR(600), link VARCHAR(300),
  read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX ix_notif_user ON notifications (user_id, created_at DESC);

CREATE TABLE user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID REFERENCES users(id), reporter_email VARCHAR(254),
  target_type VARCHAR(12) NOT NULL CHECK (target_type IN ('CAMPAIGN','BUSINESS','CREATOR')),
  target_id UUID NOT NULL,
  reason VARCHAR(20) NOT NULL CHECK (reason IN ('SPAM','SCAM','ILLEGAL','COPYRIGHT','MISLEADING','OTHER')),
  details VARCHAR(2000),
  status VARCHAR(12) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED','DISMISSED')),
  resolution VARCHAR(500), resolved_by UUID REFERENCES users(id), resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX ix_reports_status ON user_reports (status, created_at DESC);

CREATE TABLE moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id),
  target_type VARCHAR(20) NOT NULL, target_id UUID NOT NULL,
  action VARCHAR(40) NOT NULL, reason VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX ix_modactions_target ON moderation_actions (target_type, target_id, created_at DESC);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID, actor_email VARCHAR(254),
  action VARCHAR(60) NOT NULL, target_type VARCHAR(30), target_id VARCHAR(60),
  details VARCHAR(2000), ip VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX ix_audit_created ON audit_logs (created_at DESC);
CREATE INDEX ix_audit_actor ON audit_logs (actor_user_id, created_at DESC);
-- Audit history is append-only.
CREATE OR REPLACE FUNCTION forbid_audit_change() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'audit_logs is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_audit_immutable BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_change();

CREATE TABLE platform_settings (
  key VARCHAR(80) PRIMARY KEY, value VARCHAR(4000) NOT NULL, description VARCHAR(300),
  updated_by UUID, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE risk_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(30) NOT NULL CHECK (type IN ('SUSPICIOUS_CLICKS','DUPLICATE_CONVERSION','REFERRAL_ABUSE','ACCOUNT_RISK')),
  user_id UUID REFERENCES users(id),
  subject_type VARCHAR(20), subject_id VARCHAR(60),
  severity VARCHAR(10) NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW','MEDIUM','HIGH')),
  details VARCHAR(1000),
  status VARCHAR(14) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','INVESTIGATING','RESOLVED')),
  resolution_note VARCHAR(1000), resolved_by UUID REFERENCES users(id), resolved_at TIMESTAMPTZ,
  dedupe_key VARCHAR(160) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX ix_risk_status ON risk_flags (status, created_at DESC);

CREATE TABLE verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  profile_type VARCHAR(12) NOT NULL CHECK (profile_type IN ('ADVERTISER','PROMOTER')),
  note VARCHAR(1000), document_url VARCHAR(500),
  status VARCHAR(12) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  decision_reason VARCHAR(500), decided_by UUID REFERENCES users(id), decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE UNIQUE INDEX ux_verif_pending ON verification_requests (user_id, profile_type) WHERE status = 'PENDING';

CREATE TABLE analytics_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(60) NOT NULL, user_id UUID, anonymous_id VARCHAR(64),
  properties VARCHAR(2000), path VARCHAR(300),
  utm_source VARCHAR(100), utm_medium VARCHAR(100), utm_campaign VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX ix_events_name ON analytics_events (name, created_at);

CREATE TABLE contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL, email VARCHAR(254) NOT NULL, subject VARCHAR(200) NOT NULL,
  message VARCHAR(4000) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(160) NOT NULL, body VARCHAR(1000) NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email VARCHAR(254) NOT NULL, subject VARCHAR(200) NOT NULL, body TEXT NOT NULL,
  transport VARCHAR(20) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
