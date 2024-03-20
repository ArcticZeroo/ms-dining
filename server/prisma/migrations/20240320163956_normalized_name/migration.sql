-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MenuItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL DEFAULT '',
    "calories" INTEGER NOT NULL,
    "maxCalories" INTEGER NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "price" REAL NOT NULL,
    "externalLastUpdateTime" DATETIME,
    "externalReceiptText" TEXT,
    "tags" TEXT
);
INSERT INTO "new_MenuItem" ("calories", "description", "externalLastUpdateTime", "externalReceiptText", "id", "imageUrl", "maxCalories", "name", "price", "tags") SELECT "calories", "description", "externalLastUpdateTime", "externalReceiptText", "id", "imageUrl", "maxCalories", "name", "price", "tags" FROM "MenuItem";
DROP TABLE "MenuItem";
ALTER TABLE "new_MenuItem" RENAME TO "MenuItem";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
