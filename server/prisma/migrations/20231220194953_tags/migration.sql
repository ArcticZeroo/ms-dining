/*
  Warnings:

  - Added the required column `tags` to the `MenuItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DailyStation" ADD COLUMN "externalLastUpdateTime" DATETIME;

-- CreateTable
CREATE TABLE "MenuItemTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MenuItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "calories" INTEGER NOT NULL,
    "maxCalories" INTEGER NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "price" REAL NOT NULL,
    "externalLastUpdateTime" DATETIME,
    "tags" TEXT NOT NULL
);
INSERT INTO "new_MenuItem" ("calories", "description", "externalLastUpdateTime", "id", "imageUrl", "maxCalories", "name", "price") SELECT "calories", "description", "externalLastUpdateTime", "id", "imageUrl", "maxCalories", "name", "price" FROM "MenuItem";
DROP TABLE "MenuItem";
ALTER TABLE "new_MenuItem" RENAME TO "MenuItem";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
