-- CreateTable
CREATE TABLE "DailyCafe" (
    "dateString" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "cafeId" TEXT NOT NULL,

    PRIMARY KEY ("dateString", "cafeId"),
    CONSTRAINT "DailyCafe_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
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
    CONSTRAINT "DailyStation_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_DailyStation" ("cafeId", "dateString", "externalLastUpdateTime", "id", "stationId") SELECT "cafeId", "dateString", "externalLastUpdateTime", "id", "stationId" FROM "DailyStation";
DROP TABLE "DailyStation";
ALTER TABLE "new_DailyStation" RENAME TO "DailyStation";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
