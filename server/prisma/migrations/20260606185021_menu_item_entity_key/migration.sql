-- Adds MenuItem.entityKey as a SQLite STORED generated column.
--
-- Prisma cannot natively model SQLite GENERATED columns, so this migration
-- must be hand-edited. The schema declares `entityKey String @default(dbgenerated())`
-- so any prisma-managed write paths leave the column to the DB.
--
-- Future migrations that touch MenuItem MUST preserve the GENERATED ALWAYS
-- expression below — `prisma migrate dev` will silently rewrite it as a plain
-- TEXT column. preflight.ts checks for this drift on startup.

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
    "entityKey" TEXT NOT NULL GENERATED ALWAYS AS (CASE WHEN "groupId" IS NOT NULL THEN 'group:' || "groupId" ELSE 'name:' || "normalizedName" END) STORED,
    "thumbnailHash" TEXT,
    "externalLastUpdateTime" DATETIME,
    "externalReceiptText" TEXT,
    "cafeId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    CONSTRAINT "MenuItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CrossCafeGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MenuItem_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MenuItem_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MenuItem" ("cafeId", "calories", "description", "externalLastUpdateTime", "externalReceiptText", "groupId", "id", "imageUrl", "maxCalories", "name", "normalizedName", "price", "stationId", "tags", "thumbnailHash") SELECT "cafeId", "calories", "description", "externalLastUpdateTime", "externalReceiptText", "groupId", "id", "imageUrl", "maxCalories", "name", "normalizedName", "price", "stationId", "tags", "thumbnailHash" FROM "MenuItem";
DROP TABLE "MenuItem";
ALTER TABLE "new_MenuItem" RENAME TO "MenuItem";
CREATE INDEX "MenuItem_entityKey_idx" ON "MenuItem"("entityKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
