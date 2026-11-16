#!/usr/bin/env bash
# Drops and recreates the local development database. The demo data is seeded again on the next backend start.
set -euo pipefail
psql -U postgres -c "DROP DATABASE IF EXISTS promora;" -c "CREATE DATABASE promora OWNER promora;"
