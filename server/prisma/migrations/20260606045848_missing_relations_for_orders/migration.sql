-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CafeOrder" (
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
    CONSTRAINT "CafeOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CafeOrder_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CafeOrder" ("buyOnDemandOrderId", "buyOnDemandOrderNumber", "cafeId", "completedAt", "createdAt", "id", "subtotal", "tax", "total", "userId", "waitTimeMax", "waitTimeMin") SELECT "buyOnDemandOrderId", "buyOnDemandOrderNumber", "cafeId", "completedAt", "createdAt", "id", "subtotal", "tax", "total", "userId", "waitTimeMax", "waitTimeMin" FROM "CafeOrder";
DROP TABLE "CafeOrder";
ALTER TABLE "new_CafeOrder" RENAME TO "CafeOrder";
CREATE TABLE "new_CafeOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cafeOrderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "specialInstructions" TEXT,
    CONSTRAINT "CafeOrderItem_cafeOrderId_fkey" FOREIGN KEY ("cafeOrderId") REFERENCES "CafeOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CafeOrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CafeOrderItem" ("cafeOrderId", "id", "menuItemId", "name", "price", "quantity", "specialInstructions") SELECT "cafeOrderId", "id", "menuItemId", "name", "price", "quantity", "specialInstructions" FROM "CafeOrderItem";
DROP TABLE "CafeOrderItem";
ALTER TABLE "new_CafeOrderItem" RENAME TO "CafeOrderItem";
CREATE TABLE "new_CafeOrderItemModifier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cafeOrderItemId" TEXT NOT NULL,
    "modifierId" TEXT NOT NULL,
    "choiceId" TEXT NOT NULL,
    CONSTRAINT "CafeOrderItemModifier_cafeOrderItemId_fkey" FOREIGN KEY ("cafeOrderItemId") REFERENCES "CafeOrderItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CafeOrderItemModifier_modifierId_fkey" FOREIGN KEY ("modifierId") REFERENCES "MenuItemModifier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CafeOrderItemModifier_modifierId_choiceId_fkey" FOREIGN KEY ("modifierId", "choiceId") REFERENCES "MenuItemModifierChoice" ("modifierId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CafeOrderItemModifier" ("cafeOrderItemId", "choiceId", "id", "modifierId") SELECT "cafeOrderItemId", "choiceId", "id", "modifierId" FROM "CafeOrderItemModifier";
DROP TABLE "CafeOrderItemModifier";
ALTER TABLE "new_CafeOrderItemModifier" RENAME TO "CafeOrderItemModifier";
CREATE UNIQUE INDEX "CafeOrderItemModifier_cafeOrderItemId_modifierId_choiceId_key" ON "CafeOrderItemModifier"("cafeOrderItemId", "modifierId", "choiceId");
CREATE TABLE "new_CartItemModifierChoice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cartItemId" TEXT NOT NULL,
    "modifierId" TEXT NOT NULL,
    "choiceId" TEXT NOT NULL,
    CONSTRAINT "CartItemModifierChoice_cartItemId_fkey" FOREIGN KEY ("cartItemId") REFERENCES "CartItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CartItemModifierChoice_modifierId_fkey" FOREIGN KEY ("modifierId") REFERENCES "MenuItemModifier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CartItemModifierChoice_modifierId_choiceId_fkey" FOREIGN KEY ("modifierId", "choiceId") REFERENCES "MenuItemModifierChoice" ("modifierId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CartItemModifierChoice" ("cartItemId", "choiceId", "id", "modifierId") SELECT "cartItemId", "choiceId", "id", "modifierId" FROM "CartItemModifierChoice";
DROP TABLE "CartItemModifierChoice";
ALTER TABLE "new_CartItemModifierChoice" RENAME TO "CartItemModifierChoice";
CREATE UNIQUE INDEX "CartItemModifierChoice_cartItemId_modifierId_choiceId_key" ON "CartItemModifierChoice"("cartItemId", "modifierId", "choiceId");
CREATE TABLE "new_PendingCafeOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "itemsHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PendingCafeOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PendingCafeOrder_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PendingCafeOrder" ("cafeId", "createdAt", "id", "itemsHash", "userId") SELECT "cafeId", "createdAt", "id", "itemsHash", "userId" FROM "PendingCafeOrder";
DROP TABLE "PendingCafeOrder";
ALTER TABLE "new_PendingCafeOrder" RENAME TO "PendingCafeOrder";
CREATE INDEX "PendingCafeOrder_userId_cafeId_itemsHash_idx" ON "PendingCafeOrder"("userId", "cafeId", "itemsHash");
CREATE TABLE "new_PendingCafeOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pendingCafeOrderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "specialInstructions" TEXT,
    CONSTRAINT "PendingCafeOrderItem_pendingCafeOrderId_fkey" FOREIGN KEY ("pendingCafeOrderId") REFERENCES "PendingCafeOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PendingCafeOrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PendingCafeOrderItem" ("id", "menuItemId", "pendingCafeOrderId", "quantity", "specialInstructions") SELECT "id", "menuItemId", "pendingCafeOrderId", "quantity", "specialInstructions" FROM "PendingCafeOrderItem";
DROP TABLE "PendingCafeOrderItem";
ALTER TABLE "new_PendingCafeOrderItem" RENAME TO "PendingCafeOrderItem";
CREATE TABLE "new_PendingCafeOrderItemModifier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pendingCafeOrderItemId" TEXT NOT NULL,
    "modifierId" TEXT NOT NULL,
    "choiceId" TEXT NOT NULL,
    CONSTRAINT "PendingCafeOrderItemModifier_pendingCafeOrderItemId_fkey" FOREIGN KEY ("pendingCafeOrderItemId") REFERENCES "PendingCafeOrderItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PendingCafeOrderItemModifier_modifierId_fkey" FOREIGN KEY ("modifierId") REFERENCES "MenuItemModifier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PendingCafeOrderItemModifier_modifierId_choiceId_fkey" FOREIGN KEY ("modifierId", "choiceId") REFERENCES "MenuItemModifierChoice" ("modifierId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PendingCafeOrderItemModifier" ("choiceId", "id", "modifierId", "pendingCafeOrderItemId") SELECT "choiceId", "id", "modifierId", "pendingCafeOrderItemId" FROM "PendingCafeOrderItemModifier";
DROP TABLE "PendingCafeOrderItemModifier";
ALTER TABLE "new_PendingCafeOrderItemModifier" RENAME TO "PendingCafeOrderItemModifier";
CREATE UNIQUE INDEX "PendingCafeOrderItemModifier_pendingCafeOrderItemId_modifierId_choiceId_key" ON "PendingCafeOrderItemModifier"("pendingCafeOrderItemId", "modifierId", "choiceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
