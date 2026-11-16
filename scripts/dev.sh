#!/usr/bin/env bash
# Starts Promora without Docker. Needs Java 21+, Maven, Node 20+ and a local PostgreSQL 14+.
# First run only:  psql -U postgres -c "CREATE USER promora WITH PASSWORD 'promora' CREATEDB;" -c "CREATE DATABASE promora OWNER promora;"
set -euo pipefail
cd "$(dirname "$0")/.."
( cd backend && mvn -q -B spring-boot:run ) &
BACK=$!
( cd frontend && { [ -d node_modules ] || npm ci --no-audit --no-fund; } && npm run dev ) &
FRONT=$!
trap 'kill $BACK $FRONT 2>/dev/null' EXIT
echo "Website: http://localhost:5173   Admin: http://localhost:5173/admin   API docs: http://localhost:8080/swagger-ui.html"
wait
