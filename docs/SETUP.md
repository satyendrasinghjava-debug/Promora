# Environment setup guide

All configuration is by environment variable. `.env.example` lists every variable with a comment.

## Run locally without Docker (verified)

Requirements: Java 21+, Maven 3.9+, Node 20+, PostgreSQL 14+.

```bash
# once
psql -U postgres -c "CREATE USER promora WITH PASSWORD 'promora' CREATEDB;" -c "CREATE DATABASE promora OWNER promora;" -c "CREATE DATABASE promora_test OWNER promora;"
# every time
cd backend && mvn spring-boot:run            # API on http://localhost:8080 (dev profile: migrations + demo data)
cd frontend && npm ci && npm run dev         # website on http://localhost:5173
```

or `./scripts/dev.sh` for both. Flyway creates the schema on first start.

## Run with Docker Compose (written, not executed in the build environment)

```bash
cp .env.example .env      # set JWT_SECRET and HASH_SALT; keep SPRING_PROFILES_ACTIVE=dev for demo data
docker compose up --build
```

Website `http://localhost:5173`, admin `http://localhost:5173/admin`, API docs `http://localhost:8080/swagger-ui.html`, dev inbox (Mailpit) `http://localhost:8025`.

## Profiles

| Profile | Demo data | Dev verification links in API responses | JWT secret |
|---|---|---|---|
| `dev` (default locally) | Yes, labelled "(demo)" | Yes | Built-in dev value |
| any other, e.g. `prod` | No | No | `JWT_SECRET` required, 32+ bytes; the app refuses to start without it |

## First admin in production

There is no public admin registration. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12+ characters) for the first start; the account is created with the SUPER_ADMIN role. Further staff are promoted by a super admin in Admin, Users, Manage roles.

## Razorpay

1. Create a Razorpay account and generate **test** keys first.
2. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. The start-up log prints which payment provider is active.
3. In the Razorpay dashboard add a webhook to `https://<your-domain>/api/v1/payments/webhook/razorpay` for `payment.captured`, `order.paid` and `payment.failed`, and set the same secret in `RAZORPAY_WEBHOOK_SECRET`.
4. Make a test payment and confirm the transaction becomes PAID in Admin, Payments and finance.

Without keys the app runs a **sandbox**: orders are created locally, the checkout dialog says so, and a "Simulate payment (sandbox)" button confirms the payment through the same server-side signature check. No money moves. The sandbox endpoint refuses to work once Razorpay keys are set. The Razorpay code path has unit-tested signature verification but has not been exercised against Razorpay's servers.

## Email

Set `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM` for any SMTP provider. With `MAIL_HOST` empty, emails are written to the application log and recorded in Admin, Email and contact log as "not sent". In the dev profile the website shows the verification and reset links directly so flows can be completed without a mailbox.

## AI campaign assistant

Set `AI_BASE_URL` (for example `https://api.example.com/v1`), `AI_API_KEY` and `AI_MODEL` for any provider that exposes a chat-completions compatible endpoint. Without them the wizard shows "AI writing assistant is not enabled" and `POST /api/v1/ai/assist` returns 503 `AI_NOT_CONFIGURED`. Nothing is generated locally.

## Redis

`REDIS_ENABLED=true` moves rate-limit counters to Redis so several backend instances share them. With it off, counters are in memory per instance.

## Tests

```bash
cd backend && mvn test                     # Testcontainers PostgreSQL if Docker is running, else TEST_DB_URL (default localhost promora_test)
cd frontend && npm run typecheck && npm test && npm run build
cd frontend && npm run e2e                 # needs backend (dev profile) and frontend running
```

## Reset local data

`./scripts/reset-dev-db.sh`, then restart the backend.
