/*
  Warnings:

  - You are about to drop the column `alias` on the `PendingCafeOrder` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumberWithCountryCode` on the `PendingCafeOrder` table. All the data in the column will be lost.
  - Added the required column `itemsHash` to the `PendingCafeOrder` table without a default value. This is not possible if the table is not empty.

*/
-- Clean up any existing pending orders (they're temporary by design)
DELETE FROM "PendingCafeOrderItemModifier" WHERE 1=1;
DELETE FROM "PendingCafeOrderItem" WHERE 1=1;
DELETE FROM "PendingCafeOrder" WHERE 1=1;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PendingCafeOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "itemsHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PendingCafeOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PendingCafeOrder" ("cafeId", "createdAt", "id", "userId") SELECT "cafeId", "createdAt", "id", "userId" FROM "PendingCafeOrder";
DROP TABLE "PendingCafeOrder";
ALTER TABLE "new_PendingCafeOrder" RENAME TO "PendingCafeOrder";
CREATE INDEX "PendingCafeOrder_userId_cafeId_itemsHash_idx" ON "PendingCafeOrder"("userId", "cafeId", "itemsHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
