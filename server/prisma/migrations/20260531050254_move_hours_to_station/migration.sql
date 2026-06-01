/*
  Warnings:

  - You are about to drop the column `closesAt` on the `DailyStation` table. All the data in the column will be lost.
  - You are about to drop the column `externalLastUpdateTime` on the `DailyStation` table. All the data in the column will be lost.
  - You are about to drop the column `opensAt` on the `DailyStation` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Step 1: Recreate Station with new columns (opensAt, closesAt, externalMenuLastUpdateTime).
-- Backfill opensAt/closesAt from each station's latest DailyStation row.
CREATE TABLE "new_Station" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT,
    "menuId" TEXT NOT NULL,
    "opensAt" INTEGER NOT NULL DEFAULT 660,
    "closesAt" INTEGER NOT NULL DEFAULT 840,
    "externalMenuLastUpdateTime" DATETIME NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
    "groupId" TEXT,
    "cafeId" TEXT NOT NULL,
    CONSTRAINT "Station_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CrossCafeGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Station_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Station" ("id", "name", "normalizedName", "logoUrl", "menuId", "groupId", "cafeId", "opensAt", "closesAt")
SELECT
    s."id", s."name", s."normalizedName", s."logoUrl", s."menuId", s."groupId", s."cafeId",
    COALESCE(latest.opensAt, 660),
    COALESCE(latest.closesAt, 840)
FROM "Station" s
LEFT JOIN (
    SELECT ds."stationId", ds."opensAt", ds."closesAt"
    FROM "DailyStation" ds
    INNER JOIN (
        SELECT "stationId", MAX("id") AS maxId
        FROM "DailyStation"
        WHERE ("stationId", "dateString") IN (
            SELECT "stationId", MAX("dateString") FROM "DailyStation" GROUP BY "stationId"
        )
        GROUP BY "stationId"
    ) mx ON ds."id" = mx.maxId
) latest ON s."id" = latest."stationId";
DROP TABLE "Station";
ALTER TABLE "new_Station" RENAME TO "Station";

-- Step 2: Recreate DailyStation without opensAt, closesAt, externalLastUpdateTime.
CREATE TABLE "new_DailyStation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dateString" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    CONSTRAINT "DailyStation_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DailyStation_dateString_cafeId_fkey" FOREIGN KEY ("dateString", "cafeId") REFERENCES "DailyCafe" ("dateString", "cafeId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DailyStation" ("cafeId", "dateString", "id", "stationId") SELECT "cafeId", "dateString", "id", "stationId" FROM "DailyStation";
DROP TABLE "DailyStation";
ALTER TABLE "new_DailyStation" RENAME TO "DailyStation";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
