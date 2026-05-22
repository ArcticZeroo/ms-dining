/*
  Warnings:

  - You are about to drop the `OrderCafePart` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrderSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `orderCafePartId` on the `CartItem` table. All the data in the column will be lost.
  - Made the column `cartUserId` on table `CartItem` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "OrderCafePart_orderSessionId_cafeId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "OrderCafePart";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "OrderSession";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "PendingCafeOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "phoneNumberWithCountryCode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PendingCafeOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PendingCafeOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pendingCafeOrderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "specialInstructions" TEXT,
    CONSTRAINT "PendingCafeOrderItem_pendingCafeOrderId_fkey" FOREIGN KEY ("pendingCafeOrderId") REFERENCES "PendingCafeOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PendingCafeOrderItemModifier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pendingCafeOrderItemId" TEXT NOT NULL,
    "modifierId" TEXT NOT NULL,
    "choiceId" TEXT NOT NULL,
    CONSTRAINT "PendingCafeOrderItemModifier_pendingCafeOrderItemId_fkey" FOREIGN KEY ("pendingCafeOrderItemId") REFERENCES "PendingCafeOrderItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CafeOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "buyOnDemandOrderId" TEXT NOT NULL,
    "buyOnDemandOrderNumber" TEXT NOT NULL,
    "subtotal" REAL NOT NULL,
    "tax" REAL NOT NULL,
    "total" REAL NOT NULL,
    "waitTimeMin" INTEGER NOT NULL,
    "waitTimeMax" INTEGER NOT NULL,
    "completedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CafeOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CafeOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cafeOrderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "specialInstructions" TEXT,
    CONSTRAINT "CafeOrderItem_cafeOrderId_fkey" FOREIGN KEY ("cafeOrderId") REFERENCES "CafeOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CafeOrderItemModifier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cafeOrderItemId" TEXT NOT NULL,
    "modifierId" TEXT NOT NULL,
    "choiceId" TEXT NOT NULL,
    CONSTRAINT "CafeOrderItemModifier_cafeOrderItemId_fkey" FOREIGN KEY ("cafeOrderItemId") REFERENCES "CafeOrderItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CartItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cartUserId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "specialInstructions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CartItem_cartUserId_fkey" FOREIGN KEY ("cartUserId") REFERENCES "Cart" ("userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CartItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CartItem" ("cartUserId", "createdAt", "id", "menuItemId", "quantity", "specialInstructions", "updatedAt") SELECT "cartUserId", "createdAt", "id", "menuItemId", "quantity", "specialInstructions", "updatedAt" FROM "CartItem";
DROP TABLE "CartItem";
ALTER TABLE "new_CartItem" RENAME TO "CartItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PendingCafeOrderItemModifier_pendingCafeOrderItemId_modifierId_choiceId_key" ON "PendingCafeOrderItemModifier"("pendingCafeOrderItemId", "modifierId", "choiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CafeOrderItemModifier_cafeOrderItemId_modifierId_choiceId_key" ON "CafeOrderItemModifier"("cafeOrderItemId", "modifierId", "choiceId");
