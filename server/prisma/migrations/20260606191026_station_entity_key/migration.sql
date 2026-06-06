-- Adds Station.entityKey as a SQLite STORED generated column.
--
-- Prisma cannot natively model SQLite GENERATED columns, so this migration
-- must be hand-edited. The schema declares `entityKey String @default(dbgenerated())`
-- so any prisma-managed write paths leave the column to the DB.
--
-- Future migrations that touch Station MUST preserve the GENERATED ALWAYS
-- expression below — `prisma migrate dev` will silently rewrite it as a plain
-- TEXT column. preflight.ts checks for this drift on startup.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Station" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT,
    "menuId" TEXT NOT NULL,
    "opensAt" INTEGER NOT NULL DEFAULT 660,
    "closesAt" INTEGER NOT NULL DEFAULT 840,
    "externalMenuLastUpdateTime" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00 +00:00',
    "groupId" TEXT,
    "entityKey" TEXT NOT NULL GENERATED ALWAYS AS (CASE WHEN "groupId" IS NOT NULL THEN 'group:' || "groupId" ELSE 'name:' || "normalizedName" END) STORED,
    "cafeId" TEXT NOT NULL,
    CONSTRAINT "Station_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CrossCafeGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Station_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Station" ("cafeId", "closesAt", "externalMenuLastUpdateTime", "groupId", "id", "logoUrl", "menuId", "name", "normalizedName", "opensAt") SELECT "cafeId", "closesAt", "externalMenuLastUpdateTime", "groupId", "id", "logoUrl", "menuId", "name", "normalizedName", "opensAt" FROM "Station";
DROP TABLE "Station";
ALTER TABLE "new_Station" RENAME TO "Station";
CREATE INDEX "Station_entityKey_idx" ON "Station"("entityKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
