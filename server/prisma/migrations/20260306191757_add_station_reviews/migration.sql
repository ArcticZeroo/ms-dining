/*
  Warnings:

  - You are about to drop the column `menuItemNormalizedName` on the `Review` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "displayName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "menuItemId" TEXT,
    "stationId" TEXT,
    CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Review_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Review" ("comment", "createdAt", "displayName", "id", "menuItemId", "rating", "userId") SELECT "comment", "createdAt", "displayName", "id", "menuItemId", "rating", "userId" FROM "Review";
DROP TABLE "Review";
ALTER TABLE "new_Review" RENAME TO "Review";
CREATE UNIQUE INDEX "Review_userId_menuItemId_key" ON "Review"("userId", "menuItemId");
CREATE UNIQUE INDEX "Review_userId_stationId_key" ON "Review"("userId", "stationId");
CREATE TABLE "new_Station" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT,
    "menuId" TEXT NOT NULL,
    "groupId" TEXT,
    "cafeId" TEXT NOT NULL,
    CONSTRAINT "Station_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CrossCafeGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Station_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Station" ("cafeId", "groupId", "id", "logoUrl", "menuId", "name") SELECT "cafeId", "groupId", "id", "logoUrl", "menuId", "name" FROM "Station";
DROP TABLE "Station";
ALTER TABLE "new_Station" RENAME TO "Station";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
