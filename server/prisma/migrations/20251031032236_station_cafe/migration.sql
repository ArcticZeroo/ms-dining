-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Station" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "menuId" TEXT NOT NULL,
    "groupId" TEXT,
    "cafeId" TEXT NOT NULL,
    CONSTRAINT "Station_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CrossCafeGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Station_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Station" ("groupId", "id", "logoUrl", "menuId", "name", "cafeId")
SELECT DISTINCT Station.groupId, Station.id, Station.logoUrl, Station.menuId, Station.name, DailyStation.cafeId
FROM Station
INNER JOIN DailyStation on Station.id = DailyStation.stationId;
DROP TABLE "Station";
ALTER TABLE "new_Station" RENAME TO "Station";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
