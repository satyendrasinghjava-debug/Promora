# Promora API reference

Generated from the running application's OpenAPI document (`docs/openapi.json`). Interactive docs: `http://localhost:8080/swagger-ui.html`.

- Base path `/api/v1`. JSON in and out. Money is integer paise.
- Authenticate with `Authorization: Bearer <accessToken>` from `POST /api/v1/auth/login`. The refresh token is an HttpOnly cookie.
- Errors: `{ status, code, message, errors?[] }`. Lists: `{ items, page, size, total, totalPages }` with `page` and `size` query parameters (size up to 100).
- `Idempotency-Key` header is required on payment orders and payout requests.
- Every `/api/v1/admin/**` endpoint needs staff access plus the specific permission named in `AdminController`.


## AI assistant

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/ai/status` | status |
| POST | `/api/v1/ai/assist` | assist |

## Admin

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/admin/audit-logs` | auditLogs |
| GET | `/api/v1/admin/campaigns` | campaigns_1 |
| GET | `/api/v1/admin/campaigns/{id}` | campaign_1 |
| GET | `/api/v1/admin/contact-messages` | contactMessages |
| GET | `/api/v1/admin/dashboard` | dashboard_2 |
| GET | `/api/v1/admin/email-log` | emailLog |
| GET | `/api/v1/admin/finance/commissions` | commissionList |
| GET | `/api/v1/admin/finance/payouts` | payoutList |
| GET | `/api/v1/admin/finance/summary` | financeSummary |
| GET | `/api/v1/admin/finance/transactions` | transactions_1 |
| GET | `/api/v1/admin/fraud/click-patterns` | clickPatterns |
| GET | `/api/v1/admin/moderation/history` | moderationHistory |
| GET | `/api/v1/admin/moderation/reports` | reports |
| GET | `/api/v1/admin/referrals` | referralList |
| GET | `/api/v1/admin/risk-flags` | riskFlags |
| GET | `/api/v1/admin/settings` | settings |
| GET | `/api/v1/admin/users` | users |
| GET | `/api/v1/admin/users/{id}` | user |
| GET | `/api/v1/admin/verifications` | verifications |
| POST | `/api/v1/admin/announcements` | announce |
| POST | `/api/v1/admin/announcements/{id}/{action}` | toggleAnnouncement |
| POST | `/api/v1/admin/campaigns/{id}/{action}` | moderate |
| POST | `/api/v1/admin/categories` | createCategory |
| POST | `/api/v1/admin/finance/commissions/{id}/{action}` | commissionDecision |
| POST | `/api/v1/admin/finance/payouts/{id}/{action}` | payoutDecision |
| POST | `/api/v1/admin/finance/transactions/{id}/refund` | refund |
| POST | `/api/v1/admin/moderation/content/{type}/{id}/{action}` | content |
| POST | `/api/v1/admin/moderation/reports/{id}/resolve` | resolveReport |
| POST | `/api/v1/admin/referrals/rewards/{id}/{action}` | rewardDecision |
| POST | `/api/v1/admin/risk-flags/{id}` | riskUpdate |
| POST | `/api/v1/admin/users/{id}/{action}` | userVerify_1 |
| POST | `/api/v1/admin/verifications/{id}/{action}` | decideVerification |
| PUT | `/api/v1/admin/categories/{id}` | updateCategory |
| PUT | `/api/v1/admin/plans/{id}` | updatePlan |
| PUT | `/api/v1/admin/settings/{key}` | setSetting |
| PUT | `/api/v1/admin/users/{id}/roles` | userRoles |

## Admin reports

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/admin/analytics/{type}` | report_1 |

## Advertiser

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/advertiser/campaigns` | list |
| GET | `/api/v1/advertiser/campaigns/{id}` | get_1 |
| GET | `/api/v1/advertiser/campaigns/{id}/applications` | applications |
| GET | `/api/v1/advertiser/dashboard` | dashboard_1 |
| POST | `/api/v1/advertiser/campaigns` | create |
| POST | `/api/v1/advertiser/campaigns/{id}/submit` | submit |
| POST | `/api/v1/advertiser/campaigns/{id}/{action}` | transition |
| PUT | `/api/v1/advertiser/campaigns/{id}` | update |

## Authentication

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/auth/forgot-password` | forgot |
| POST | `/api/v1/auth/login` | login |
| POST | `/api/v1/auth/logout` | logout |
| POST | `/api/v1/auth/refresh` | refresh |
| POST | `/api/v1/auth/register` | register |
| POST | `/api/v1/auth/reset-password` | reset |
| POST | `/api/v1/auth/verify-email` | verify_1 |

## My account

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/me` | get |
| GET | `/api/v1/me/data-export` | export |
| GET | `/api/v1/me/notifications` | notifications |
| GET | `/api/v1/me/referrals` | referralDashboard |
| GET | `/api/v1/me/transactions` | transactions |
| POST | `/api/v1/me/change-password` | changePassword |
| POST | `/api/v1/me/notifications/read-all` | readAll |
| POST | `/api/v1/me/notifications/{id}/read` | read |
| POST | `/api/v1/me/resend-verification` | resend |
| POST | `/api/v1/me/verification-requests` | requestVerification |
| PUT | `/api/v1/me/advertiser-profile` | saveAdvertiser |
| PUT | `/api/v1/me/profile` | updateProfile |
| PUT | `/api/v1/me/promoter-profile` | savePromoter |

## Payments

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/payments/config` | config |
| GET | `/api/v1/payments/subscription` | mySubscription |
| POST | `/api/v1/payments/campaigns/{campaignId}/order` | campaignOrder |
| POST | `/api/v1/payments/sandbox/{transactionId}/complete` | sandbox |
| POST | `/api/v1/payments/subscriptions/order` | subscriptionOrder |
| POST | `/api/v1/payments/verify` | verify |
| POST | `/api/v1/payments/webhook/razorpay` | webhook |

## Promoter

| Method | Path | Handler |
|---|---|---|
| DELETE | `/api/v1/promoter/applications/{id}` | withdraw |
| GET | `/api/v1/promoter/applications` | myApplications |
| GET | `/api/v1/promoter/dashboard` | dashboard |
| GET | `/api/v1/promoter/earnings` | earnings |
| POST | `/api/v1/advertiser/applications/{id}/{decision}` | decide |
| POST | `/api/v1/campaigns/{id}/applications` | apply |
| POST | `/api/v1/promoter/payouts` | requestPayout |

## Public

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/public/announcements` | announcements |
| GET | `/api/v1/public/businesses` | businesses |
| GET | `/api/v1/public/businesses/{slug}` | business |
| GET | `/api/v1/public/campaigns` | campaigns |
| GET | `/api/v1/public/campaigns/{id}` | campaign |
| GET | `/api/v1/public/categories` | categories |
| GET | `/api/v1/public/creators` | creators |
| GET | `/api/v1/public/creators/{slug}` | creator |
| GET | `/api/v1/public/plans` | plans |
| GET | `/api/v1/public/policy` | policy |
| GET | `/api/v1/public/search` | search |
| GET | `/api/v1/public/stats` | stats |
| POST | `/api/v1/public/contact` | contact |
| POST | `/api/v1/public/events` | event |
| POST | `/api/v1/public/leads` | lead |
| POST | `/api/v1/public/reports` | report |

## Tracking

| Method | Path | Handler |
|---|---|---|
| GET | `/r/{code}` | redirect |

## Uploads

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/uploads/images` | upload |

## seo-controller

| Method | Path | Handler |
|---|---|---|
| GET | `/robots.txt` | robots |
| GET | `/seo/render` | render |
| GET | `/sitemap.xml` | sitemap |
