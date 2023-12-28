-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Cafe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "logoName" TEXT,
    "contextId" TEXT NOT NULL,
    "displayProfileId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL DEFAULT '',
    "externalName" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_Cafe" ("contextId", "displayProfileId", "id", "logoName", "name", "tenantId") SELECT "contextId", "displayProfileId", "id", "logoName", "name", "tenantId" FROM "Cafe";
DROP TABLE "Cafe";
ALTER TABLE "new_Cafe" RENAME TO "Cafe";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
