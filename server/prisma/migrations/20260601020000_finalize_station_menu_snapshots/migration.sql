/*
  Migration 2: Finalize station menu snapshots.

  Prerequisites:
  - Migration 1 (add_station_menu_snapshots) must have been applied.
  - The backfill script (adhoc/backfill-snapshots.ts) must have been run.

  If this migration fails with "NOT NULL constraint failed: new_DailyStation.snapshotId",
  the backfill script has not been run. To recover:
    1. sqlite3 dining.db "DROP TABLE IF EXISTS new_DailyStation; DROP TABLE IF EXISTS new_DailyCategory;"
    2. npx prisma migrate resolve --rolled-back 20260601020000_finalize_station_menu_snapshots
    3. npx tsx src/adhoc/backfill-snapshots.ts
    4. npx prisma migrate deploy

  This migration:
  1. Makes DailyStation.snapshotId NOT NULL
  2. Drops old DailyCategory.stationId column (was FK to DailyStation)
  3. Makes DailyCategory.snapshotId NOT NULL
*/

-- Clean up leftover temp tables from a previous failed attempt
DROP TABLE IF EXISTS "new_DailyStation";
DROP TABLE IF EXISTS "new_DailyCategory";

-- Recreate tables with NOT NULL constraints and without old columns
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- DailyStation: make snapshotId NOT NULL
CREATE TABLE "new_DailyStation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dateString" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    CONSTRAINT "DailyStation_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DailyStation_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "StationMenuSnapshot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DailyStation_dateString_cafeId_fkey" FOREIGN KEY ("dateString", "cafeId") REFERENCES "DailyCafe" ("dateString", "cafeId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DailyStation" ("id", "dateString", "stationId", "snapshotId", "cafeId")
    SELECT "id", "dateString", "stationId", "snapshotId", "cafeId" FROM "DailyStation";
DROP TABLE "DailyStation";
ALTER TABLE "new_DailyStation" RENAME TO "DailyStation";

-- DailyCategory: drop old stationId, make snapshotId NOT NULL
CREATE TABLE "new_DailyCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    CONSTRAINT "DailyCategory_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "StationMenuSnapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DailyCategory" ("id", "name", "snapshotId")
    SELECT "id", "name", "snapshotId" FROM "DailyCategory";
DROP TABLE "DailyCategory";
ALTER TABLE "new_DailyCategory" RENAME TO "DailyCategory";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
