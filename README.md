# Promora

**One Platform. Infinite Possibilities.** A promotion marketplace: advertisers publish campaigns, promoters share unique tracking links, and rewards are paid only for verified results.

React + TypeScript + Vite + Tailwind on the front, Java 21 + Spring Boot 3.3 + PostgreSQL + Flyway on the back.

## Quick start (verified)

Requirements: Java 21+, Maven 3.9+, Node 20+, PostgreSQL 14+.

```bash
psql -U postgres -c "CREATE USER promora WITH PASSWORD 'promora' CREATEDB;" -c "CREATE DATABASE promora OWNER promora;" -c "CREATE DATABASE promora_test OWNER promora;"
cd backend && mvn spring-boot:run        # terminal 1
cd frontend && npm ci && npm run dev     # terminal 2
```

| What | URL |
|---|---|
| Website | http://localhost:5173 |
| Admin panel | http://localhost:5173/admin |
| API documentation (Swagger UI) | http://localhost:8080/swagger-ui.html |
| Health check | http://localhost:8080/actuator/health |

Docker alternative (configuration written but **not executed** in the build environment, which had no Docker daemon): `cp .env.example .env && docker compose up --build`.

More detail: [docs/SETUP.md](docs/SETUP.md).

## Demo accounts (dev profile only)

Password for all: `Promora@123`. Everything they own is development seed data and is labelled "(demo)".

| Role | Email |
|---|---|
| Super admin | admin@promora.dev |
| Advertiser | advertiser@promora.dev |
| Advertiser (second business) | academy@promora.dev |
| Promoter | promoter@promora.dev |

The demo data includes four live campaigns funded by sandbox transactions, so dashboards show non-zero figures that are demo figures, not real revenue.

## Project layout

```
backend/         Spring Boot application (com.promora.*), Flyway migrations, tests
frontend/        React application, design tokens, brand assets, unit and end-to-end tests
infrastructure/  nginx configuration used by the frontend image
docs/            API reference, OpenAPI JSON, setup, security and compliance notes, image prompts
scripts/         dev.sh, test.sh, reset-dev-db.sh, generate-assets.mjs
docker-compose.yml, .env.example
```

## Test results (run on the delivered code)

| Suite | Result | Notes |
|---|---|---|
| Backend `mvn test` | 38 passed, 0 failed | 27 unit cases; 11 integration tests through the full HTTP stack against PostgreSQL 16, with the schema rebuilt from the Flyway migrations and Hibernate schema validation on every run |
| Frontend `tsc --noEmit` | clean | strict mode |
| Frontend `vitest` | 13 passed | formatting, components, form validation, login errors, route protection |
| Frontend `vite build` | success | public, account, advertiser, promoter and admin code are separate chunks |
| Playwright end-to-end | 2 passed | register, verify email, profiles, 8-step wizard, admin approval, sandbox payment, referral sign-up, apply, tracking link, click, referral reward approval, analytics, audit log, role restrictions, logout; plus a mobile pass |

What the integration tests prove: fee and GST arithmetic; campaign state machine; one qualified click per visitor per day; bots, refreshes and self-clicks unpaid; budget never overspent, also enforced by a database constraint; lead de-duplication; idempotent payouts and webhooks; forged payment signatures refused; referral reward exactly once after activation and approval; every admin endpoint closed to anonymous users, normal users and staff without the permission; suspension effective on the next request; password reset invalidates old tokens; refresh-token reuse detection; append-only audit log.

Verification gaps:

- **Testcontainers** is wired in and used automatically when Docker is available, but the build environment had no Docker daemon, so tests ran against a local PostgreSQL 16 instead.
- **Docker images, Compose and the nginx configuration were not built or run.**
- In the end-to-end test the visitor and the promoter share one machine, so the click is correctly rejected as a self-click. Paid qualified clicks from distinct addresses are covered by the backend integration tests.
- Mockito is available but no test needed mocks; behaviour is tested against the real database.

## Feature completion matrix

| Feature | Implemented | Tested | External setup required |
|---|---|---|---|
| Public website: home, about, how it works, pricing, discover, campaigns, campaign detail, categories, creators, businesses, profile pages, contact, FAQ, legal | Yes | E2E (home, campaigns, pricing, legal, contact) plus a page sweep for errors and mobile overflow | No |
| Brand identity, design system, original SVG logo, hero, illustrations, empty states, category art, social templates, asset manifest | Yes, as vector art | Visual check by screenshot | Optional: generate raster art from `docs/PROMORA_IMAGE_GENERATION_PROMPTS.md` |
| Registration, login, logout, refresh rotation, forgot and reset password | Yes | Integration, unit, E2E | No |
| Email verification | Yes | Integration, E2E (dev link) | SMTP to deliver real email |
| Roles USER, ADVERTISER, PROMOTER, ADMIN, SUPER_ADMIN and granular admin permissions | Yes | Integration, unit, E2E | No |
| Profile completion, account settings, data export | Yes | E2E (profile) | No |
| Advertiser dashboard with live metrics and chart | Yes | E2E | No |
| 8-step campaign wizard with server drafts and image upload | Yes | E2E (upload itself not exercised by a test) | No |
| Campaign management: edit, submit, pause, resume, cancel, end, performance, applications, promoters, transactions, leads | Yes | Integration (state machine, ownership), E2E (submit, fund) | No |
| Promoter profile, marketplace, apply, application status, tracking links, instructions, click and conversion reporting | Yes | Integration, E2E | No |
| Commissions, earnings history, payout requests | Yes | Integration | Payout transfers are made outside Promora and recorded by an admin |
| Marketplace search, category, objective, reward, budget and geography filters, sorting, pagination | Yes | Integration (search, filter), E2E (search, empty state) | No |
| Click tracking with attribution, de-duplication, bot and suspicious-activity filtering | Yes | Integration, unit, E2E | No |
| Lead (pay-per-lead) capture with consent and de-duplication | Yes | Integration | No |
| Admin dashboard, users, campaign moderation, verification, finance, referrals, fraud, content moderation, reports with CSV, settings, audit log | Yes | Integration (moderation, users, finance, referrals, reports, settings), E2E (approval, referral reward, reports, audit) | No |
| Referral codes, attribution, activation, fraud flags, admin-approved promo credits | Yes | Integration, E2E | No |
| Payments: provider abstraction, orders, verification, webhook, refunds, transaction records | Yes | Integration in sandbox; Razorpay signature scheme unit-tested | **Razorpay keys.** Not verified against Razorpay's servers |
| Subscriptions | Partly: monthly plan purchase as a one-off order that activates the plan for 30 days and lowers the fee | Not covered by an automated test | Razorpay keys; recurring billing is not implemented |
| AI campaign assistant | Yes, behind a provider interface with an honest disabled state | Disabled state tested | **AI provider credentials.** Not tested against a real provider |
| In-app notifications and email abstraction | Yes | Integration (in-app), E2E | SMTP for real email; the SMTP path was not exercised |
| Application analytics events, UTM attribution, reports | Yes | Integration, E2E | No |
| SEO: titles, descriptions, canonical, Open Graph, sitemap, robots, crawler snapshot with JSON-LD | Yes | Sitemap and snapshot endpoint tested | Crawler routing depends on the nginx config, which was not run |
| Security: hashing, RBAC, validation, CORS, rate limiting, upload checks, audit trail, webhook verification | Yes | Integration, unit | No |
| Responsive layouts: mobile navigation, card tables, drawers | Yes | E2E mobile test and overflow sweep | No |
| Docker and Docker Compose | Written | **Not run** | Docker |
| S3-compatible storage | Abstraction and local-disk implementation only | Local path only | An S3 implementation of `StorageService` |
| Redis rate limiting | Yes, switchable | In-memory path only | Redis with `REDIS_ENABLED=true` |

## Known limitations

- No raster or 3D imagery was generated; all artwork is original SVG. The Open Graph image is SVG, which some platforms will not preview; export a PNG.
- Payments run in sandbox until Razorpay keys are set. No real payment has been processed.
- Payouts are a manual workflow: an admin approves, pays by UPI or bank outside Promora, and records the reference.
- Plans are not recurring subscriptions, and plan campaign limits are stored but not enforced.
- Only pay-per-qualified-click and pay-per-lead campaigns exist. Pay-per-sale needs an advertiser-side integration and is not built.
- A visitor is identified by a salted hash of IP address and browser, so people sharing a network and browser version count once per day per campaign. This is deliberately conservative.
- The public marketplace lists live campaigns only; the status filter exists in the advertiser and admin lists.
- Legal pages are templates marked as pending legal review. No tax invoices are issued. See [docs/SECURITY_AND_COMPLIANCE.md](docs/SECURITY_AND_COMPLIANCE.md).
- No admin two-factor authentication, no self-service account deletion, no automated data-retention jobs.
- Testimonials on the homepage are labelled sample content.
- The interface is English only.

## Documentation

- [docs/API.md](docs/API.md): all 102 endpoints, generated from the live OpenAPI document (`docs/openapi.json`).
- [docs/SETUP.md](docs/SETUP.md): environment variables, Razorpay, email, AI, Redis, tests.
- [docs/SECURITY_AND_COMPLIANCE.md](docs/SECURITY_AND_COMPLIANCE.md): controls implemented, gaps, and what needs a lawyer or accountant.
- [docs/PROMORA_IMAGE_GENERATION_PROMPTS.md](docs/PROMORA_IMAGE_GENERATION_PROMPTS.md): the image prompts and where each asset lives.
