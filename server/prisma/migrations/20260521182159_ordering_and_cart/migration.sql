-- DropIndex
DROP INDEX "StationTheme_itemHash_key";

-- CreateTable
CREATE TABLE "Cart" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CartItem" (
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

-- CreateTable
CREATE TABLE "CartItemModifierChoice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cartItemId" TEXT NOT NULL,
    "modifierId" TEXT NOT NULL,
    "choiceId" TEXT NOT NULL,
    CONSTRAINT "CartItemModifierChoice_cartItemId_fkey" FOREIGN KEY ("cartItemId") REFERENCES "CartItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "alias" TEXT,
    "phoneNumberWithCountryCode" TEXT,
    CONSTRAINT "OrderSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderCafePart" (
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
    "itemsJson" TEXT NOT NULL DEFAULT '[]',
    "sessionStateJson" TEXT,
    "lastError" TEXT,
    "lastStage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "OrderCafePart_orderSessionId_fkey" FOREIGN KEY ("orderSessionId") REFERENCES "OrderSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CartItemModifierChoice_cartItemId_modifierId_choiceId_key" ON "CartItemModifierChoice"("cartItemId", "modifierId", "choiceId");
