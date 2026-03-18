-- CreateTable
CREATE TABLE "IngredientsMenuMetadata" (
    "menuHash" TEXT NOT NULL PRIMARY KEY,
    "price" REAL NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_IngredientsMenuRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menuItemId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "menuHash" TEXT NOT NULL,
    CONSTRAINT "IngredientsMenuRole_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IngredientsMenuRole_menuHash_fkey" FOREIGN KEY ("menuHash") REFERENCES "IngredientsMenuMetadata" ("menuHash") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_IngredientsMenuRole" ("id", "menuHash", "menuItemId", "role") SELECT "id", "menuHash", "menuItemId", "role" FROM "IngredientsMenuRole";
DROP TABLE "IngredientsMenuRole";
ALTER TABLE "new_IngredientsMenuRole" RENAME TO "IngredientsMenuRole";
CREATE UNIQUE INDEX "IngredientsMenuRole_menuItemId_menuHash_key" ON "IngredientsMenuRole"("menuItemId", "menuHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
