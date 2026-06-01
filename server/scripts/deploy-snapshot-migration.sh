#!/usr/bin/env bash
# deploy-snapshot-migration.sh
#
# Runs the full snapshot migration:
#   1. Resolves the expected migration 2 failure (backfill not yet run)
#   2. Runs the backfill script
#   3. Re-applies migration 2
#
# Prerequisites: npx prisma migrate deploy has already been run and
# migration 2 (finalize_station_menu_snapshots) has failed.

set -euo pipefail

MIGRATION_NAME="20260601020000_finalize_station_menu_snapshots"

echo "=== Step 1: Resolving failed migration ==="
npx prisma migrate resolve --rolled-back "$MIGRATION_NAME"

echo ""
echo "=== Step 2: Running backfill script ==="
npx tsx src/adhoc/backfill-snapshots.ts

echo ""
echo "=== Step 3: Applying finalize migration ==="
npx prisma migrate deploy

echo ""
echo "=== Done! ==="
