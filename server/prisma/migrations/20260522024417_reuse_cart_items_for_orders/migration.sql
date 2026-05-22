/*
  Warnings:

  - You are about to drop the `OrderCafePartItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrderCafePartItemModifier` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "OrderCafePartItemModifier_orderCafePartItemId_modifierId_choiceId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "OrderCafePartItem";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "OrderCafePartItemModifier";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CartItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cartUserId" TEXT,
    "orderCafePartId" TEXT,
    "menuItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "specialInstructions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CartItem_cartUserId_fkey" FOREIGN KEY ("cartUserId") REFERENCES "Cart" ("userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CartItem_orderCafePartId_fkey" FOREIGN KEY ("orderCafePartId") REFERENCES "OrderCafePart" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CartItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CartItem" ("cartUserId", "createdAt", "id", "menuItemId", "quantity", "specialInstructions", "updatedAt") SELECT "cartUserId", "createdAt", "id", "menuItemId", "quantity", "specialInstructions", "updatedAt" FROM "CartItem";
DROP TABLE "CartItem";
ALTER TABLE "new_CartItem" RENAME TO "CartItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
