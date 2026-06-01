/*
  Migration 1: Add StationMenuSnapshot table and nullable snapshotId columns.

  DailyCategory and DailyStation both get a nullable snapshotId column.
  The old DailyCategory.stationId (FK to DailyStation) is kept for the
  backfill script to read from.

  After running the backfill script (adhoc/backfill-snapshots.ts), apply
  migration 2 (finalize_station_menu_snapshots) to make snapshotId NOT NULL
  and drop the old DailyCategory.stationId column.
*/

-- CreateTable
CREATE TABLE "StationMenuSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stationId" TEXT NOT NULL,
    CONSTRAINT "StationMenuSnapshot_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Add nullable snapshotId to DailyStation (backfill will populate it)
ALTER TABLE "DailyStation" ADD COLUMN "snapshotId" TEXT
    REFERENCES "StationMenuSnapshot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add nullable snapshotId to DailyCategory (backfill will populate it)
-- Keep old stationId column for backfill to read from.
ALTER TABLE "DailyCategory" ADD COLUMN "snapshotId" TEXT
    REFERENCES "StationMenuSnapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
