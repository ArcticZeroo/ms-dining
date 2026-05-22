/*
  Warnings:

  - You are about to drop the column `itemsJson` on the `OrderCafePart` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `OrderCafePart` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "OrderCafePartItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderCafePartId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "specialInstructions" TEXT,
    CONSTRAINT "OrderCafePartItem_orderCafePartId_fkey" FOREIGN KEY ("orderCafePartId") REFERENCES "OrderCafePart" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderCafePartItemModifier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderCafePartItemId" TEXT NOT NULL,
    "modifierId" TEXT NOT NULL,
    "choiceId" TEXT NOT NULL,
    CONSTRAINT "OrderCafePartItemModifier_orderCafePartItemId_fkey" FOREIGN KEY ("orderCafePartItemId") REFERENCES "OrderCafePartItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OrderCafePart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderSessionId" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "buyOnDemandOrderId" TEXT,
    "buyOnDemandOrderNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "subtotal" REAL,
    "tax" REAL,
    "total" REAL,
    "waitTimeMin" INTEGER,
    "waitTimeMax" INTEGER,
    "sessionStateJson" TEXT,
    "lastError" TEXT,
    "lastStage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "OrderCafePart_orderSessionId_fkey" FOREIGN KEY ("orderSessionId") REFERENCES "OrderSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OrderCafePart" ("buyOnDemandOrderId", "buyOnDemandOrderNumber", "cafeId", "completedAt", "createdAt", "id", "lastError", "lastStage", "orderSessionId", "sessionStateJson", "status", "subtotal", "tax", "total", "waitTimeMax", "waitTimeMin") SELECT "buyOnDemandOrderId", "buyOnDemandOrderNumber", "cafeId", "completedAt", "createdAt", "id", "lastError", "lastStage", "orderSessionId", "sessionStateJson", "status", "subtotal", "tax", "total", "waitTimeMax", "waitTimeMin" FROM "OrderCafePart";
DROP TABLE "OrderCafePart";
ALTER TABLE "new_OrderCafePart" RENAME TO "OrderCafePart";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "OrderCafePartItemModifier_orderCafePartItemId_modifierId_choiceId_key" ON "OrderCafePartItemModifier"("orderCafePartItemId", "modifierId", "choiceId");
