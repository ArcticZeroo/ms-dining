-- CreateTable
CREATE TABLE "CrossCafeGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "entityType" TEXT NOT NULL
);

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
    "groupId" TEXT,
    "externalLastUpdateTime" DATETIME,
    "externalReceiptText" TEXT,
    "cafeId" TEXT NOT NULL,
    CONSTRAINT "MenuItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CrossCafeGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MenuItem_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MenuItem" ("cafeId", "calories", "description", "externalLastUpdateTime", "externalReceiptText", "id", "imageUrl", "maxCalories", "name", "normalizedName", "price", "tags") SELECT "cafeId", "calories", "description", "externalLastUpdateTime", "externalReceiptText", "id", "imageUrl", "maxCalories", "name", "normalizedName", "price", "tags" FROM "MenuItem";
DROP TABLE "MenuItem";
ALTER TABLE "new_MenuItem" RENAME TO "MenuItem";
CREATE TABLE "new_Station" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "menuId" TEXT NOT NULL,
    "groupId" TEXT,
    CONSTRAINT "Station_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CrossCafeGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Station" ("id", "logoUrl", "menuId", "name") SELECT "id", "logoUrl", "menuId", "name" FROM "Station";
DROP TABLE "Station";
ALTER TABLE "new_Station" RENAME TO "Station";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
