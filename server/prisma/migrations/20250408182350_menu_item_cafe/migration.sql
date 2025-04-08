/*
  Warnings:

  - Added the required column `cafeId` to the `MenuItem` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MenuItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL DEFAULT '',
    "description" TEXT,
    "imageUrl" TEXT,
    "tags" TEXT,
    "calories" INTEGER NOT NULL,
    "maxCalories" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "externalLastUpdateTime" DATETIME,
    "externalReceiptText" TEXT,
    "cafeId" TEXT NOT NULL,
    CONSTRAINT "MenuItem_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MenuItem" ("calories", "description", "externalLastUpdateTime", "externalReceiptText", "id", "imageUrl", "maxCalories", "name", "normalizedName", "price", "tags", "cafeId")
    SELECT MenuItem.calories, MenuItem.description, MenuItem.externalLastUpdateTime, MenuItem.externalReceiptText, MenuItem.id, MenuItem.imageUrl, MenuItem.maxCalories, MenuItem.name, MenuItem.normalizedName, MenuItem.price, MenuItem.tags, DailyStation.cafeId FROM "MenuItem"
    INNER JOIN DailyMenuItem ON DailyMenuItem.menuItemId = MenuItem.id
    INNER JOIN DailyCategory ON DailyCategory.id = DailyMenuItem.categoryId
    INNER JOIN DailyStation ON DailyStation.id = DailyCategory.stationId
    INNER JOIN Station on Station.id = DailyStation.stationId
    GROUP BY MenuItem.id;
DROP TABLE "MenuItem";
ALTER TABLE "new_MenuItem" RENAME TO "MenuItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
