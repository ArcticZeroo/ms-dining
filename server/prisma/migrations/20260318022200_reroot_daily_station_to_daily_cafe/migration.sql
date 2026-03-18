-- Backfill DailyCafe rows for every (dateString, cafeId) that exists in DailyStation
-- but not yet in DailyCafe. Uses default isAvailable = true.
INSERT OR IGNORE INTO "DailyCafe" ("dateString", "cafeId", "isAvailable")
    SELECT DISTINCT "dateString", "cafeId", 1 FROM "DailyStation";

-- RedefineTables
-- Swap DailyStation FK from Cafe(id) to DailyCafe(dateString, cafeId)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DailyStation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dateString" TEXT NOT NULL,
    "externalLastUpdateTime" DATETIME,
    "opensAt" INTEGER NOT NULL DEFAULT 660,
    "closesAt" INTEGER NOT NULL DEFAULT 840,
    "stationId" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    CONSTRAINT "DailyStation_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DailyStation_dateString_cafeId_fkey" FOREIGN KEY ("dateString", "cafeId") REFERENCES "DailyCafe" ("dateString", "cafeId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DailyStation" ("id", "dateString", "externalLastUpdateTime", "opensAt", "closesAt", "stationId", "cafeId")
    SELECT "id", "dateString", "externalLastUpdateTime", "opensAt", "closesAt", "stationId", "cafeId" FROM "DailyStation";
DROP TABLE "DailyStation";
ALTER TABLE "new_DailyStation" RENAME TO "DailyStation";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
