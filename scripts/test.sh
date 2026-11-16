#!/usr/bin/env bash
# Runs every automated check. Backend integration tests use Testcontainers when Docker is available,
# otherwise the PostgreSQL database in TEST_DB_URL (default jdbc:postgresql://localhost:5432/promora_test, user/password promora).
set -euo pipefail
cd "$(dirname "$0")/.."
( cd backend && mvn -B test )
( cd frontend && npm run typecheck && npm test && npm run build )
echo "End-to-end tests need the app running (scripts/dev.sh), then: cd frontend && npm run e2e"
