# Security, privacy and compliance notes

Implementing these controls does not make the service legally compliant. Items under "Needs professional review" must be handled by a qualified Indian lawyer or chartered accountant before launch with real users and money.

## Implemented in code

| Area | Control | Where |
|---|---|---|
| Passwords | BCrypt hashes; 8 to 72 characters with a letter and a number; never returned by the API | `SecurityConfig`, `AuthDtos` |
| Sessions | 15-minute access JWT held in browser memory; rotating refresh token in an HttpOnly, SameSite=Lax cookie scoped to `/api/v1/auth`; reuse of a rotated token revokes all sessions; password change or reset invalidates every token | `AuthService`, `JwtService` |
| Authorisation | Deny by default; role checks with `@PreAuthorize`; ownership checks in services (other users' records return 404); admin API needs `admin.access` plus a per-endpoint permission; authorities are reloaded from the database on every request so suspension is immediate | `SecurityConfig`, `JwtAuthFilter`, `AdminController` |
| CSRF | API calls carry a bearer token, not ambient cookies, so CSRF tokens are not required. Only the refresh and logout endpoints read a cookie; it is SameSite=Lax and those endpoints return or revoke tokens but do not change other state | `SecurityConfig` |
| Input | Bean Validation on every request body; server-side URL, enum and range rules; unknown sort keys ignored; all SQL is parameterised | DTO records, `Sql` |
| XSS | React escapes output; no `dangerouslySetInnerHTML`; SEO snapshot HTML-escapes database values; external links use `rel="noopener noreferrer nofollow"` | frontend, `SeoController` |
| Uploads | PNG, JPEG, WebP only, decided from file bytes; 5 MB limit; server-generated file names | `LocalStorage` |
| Rate limiting | Per-IP fixed windows by endpoint group; 429 with `Retry-After` | `RateLimitFilter` |
| Payments | Amounts computed on the server; payment marked paid only after signature verification; webhook HMAC verified on the raw body; webhook events and payment application are idempotent | `PaymentService` |
| Money integrity | Integer paise; database CHECK that spend never exceeds funding; row locks on campaign, transaction, payout; unique constraints on conversions and commissions; idempotency keys on orders and payouts | `V1__schema.sql`, services |
| Tracking fraud | Bot and preview user agents, duplicate visitor per day, self-click, velocity per IP, inactive link or campaign, exhausted budget; risk flags for patterns | `TrackingService` |
| Referral fraud | One referrer per person, self-referral blocked by constraint, same-IP and burst sign-ups flagged, reward only after activation and admin approval, monthly cap | `ReferralService` |
| Audit | Append-only `audit_logs` (database trigger rejects UPDATE and DELETE) and `moderation_actions` for admin decisions | `AuditService`, `AdminActions` |
| Privacy | IP addresses stored only as salted hashes; marketing consent separate and optional; terms acceptance timestamp; self-service data export; lead capture requires consent; no advertising cookies | `MeController`, `TrackingService` |
| Moderation | Every campaign reviewed before going live; report button on campaigns and profiles including copyright complaints; takedown with history | `AdminActions`, `PublicController` |
| Disclosure | Promoters must acknowledge the advertising-disclosure rule before a link is issued; public campaign pages are labelled "Sponsored campaign" | `PromoterController`, campaign pages |
| Secrets | Environment variables only; the app will not start outside dev without a 32-byte `JWT_SECRET` | `application.yml`, `JwtService` |

## Not implemented (engineering gaps)

- Two-factor authentication for admin accounts.
- Account deletion is by request through the contact form; there is no self-service erase job.
- Malware scanning of uploads; a content-security-policy header for the website (set it at the reverse proxy).
- Automated data-retention jobs (for example purging old click rows).
- Phone number or payout-account name verification.

## Needs professional review before launch

- Terms of Service, Privacy Policy and Refund Policy: the in-app texts are templates and say so on the page.
- Digital Personal Data Protection Act and Rules: notice wording, consent records, retention periods, breach process, grievance contact, data-principal request handling.
- Whether Promora is an intermediary and which due-diligence and grievance-officer duties apply.
- Advertising rules: ASCI influencer guidelines and consumer-protection endorsement guidance; restricted categories.
- Money: whether holding advertiser funds needs an escrow, nodal or split-settlement arrangement; GST registration and invoicing; tax deduction on promoter payouts; invoice format. The app records fee and GST amounts but does not issue tax invoices.
- Payment-gateway onboarding requirements and the refund policy they require.
