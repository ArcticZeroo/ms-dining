-- CreateTable
CREATE TABLE "StationTheme" (
    "itemHash" TEXT NOT NULL PRIMARY KEY,
    "theme" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Cafe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "logoName" TEXT,
    "contextId" TEXT NOT NULL,
    "displayProfileId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL DEFAULT '',
    "externalName" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "CrossCafeGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "MenuItem" (
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
    "thumbnailHash" TEXT,
    "externalLastUpdateTime" DATETIME,
    "externalReceiptText" TEXT,
    "cafeId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    CONSTRAINT "MenuItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CrossCafeGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MenuItem_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MenuItem_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MenuItemModifierEntry" (
    "modifierId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,

    PRIMARY KEY ("modifierId", "menuItemId"),
    CONSTRAINT "MenuItemModifierEntry_modifierId_fkey" FOREIGN KEY ("modifierId") REFERENCES "MenuItemModifier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MenuItemModifierEntry_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MenuItemTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "SearchTag" (
    "name" TEXT NOT NULL PRIMARY KEY
);

-- CreateTable
CREATE TABLE "MenuItemModifier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "minimum" INTEGER NOT NULL,
    "maximum" INTEGER NOT NULL,
    "choiceType" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "MenuItemModifierChoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "modifierId" TEXT NOT NULL,
    CONSTRAINT "MenuItemModifierChoice_modifierId_fkey" FOREIGN KEY ("modifierId") REFERENCES "MenuItemModifier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Station" (
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

-- CreateTable
CREATE TABLE "DailyStation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dateString" TEXT NOT NULL,
    "externalLastUpdateTime" DATETIME,
    "stationId" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    CONSTRAINT "DailyStation_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DailyStation_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "stationId" INTEGER NOT NULL,
    CONSTRAINT "DailyCategory_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "DailyStation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyMenuItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "menuItemId" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    CONSTRAINT "DailyMenuItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DailyMenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DailyCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyCafeOrderingContext" (
    "dateString" TEXT NOT NULL,
    "onDemandEmployeeId" TEXT NOT NULL,
    "onDemandTerminalId" TEXT NOT NULL,
    "profitCenterId" TEXT NOT NULL,
    "profitCenterName" TEXT NOT NULL,
    "storePriceLevel" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,

    PRIMARY KEY ("dateString", "cafeId"),
    CONSTRAINT "DailyCafeOrderingContext_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "favoriteStations" TEXT,
    "favoriteMenuItems" TEXT,
    "homepageIds" TEXT,
    "lastSettingsUpdate" DATETIME
);

-- CreateTable
CREATE TABLE "Review" (
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

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SearchQuery" (
    "query" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_MenuItemToSearchTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_MenuItemToSearchTag_A_fkey" FOREIGN KEY ("A") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_MenuItemToSearchTag_B_fkey" FOREIGN KEY ("B") REFERENCES "SearchTag" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StationTheme_itemHash_key" ON "StationTheme"("itemHash");

-- CreateIndex
CREATE UNIQUE INDEX "SearchTag_name_key" ON "SearchTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_externalId_provider_key" ON "User"("externalId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_menuItemId_key" ON "Review"("userId", "menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_stationId_key" ON "Review"("userId", "stationId");

-- CreateIndex
CREATE UNIQUE INDEX "_MenuItemToSearchTag_AB_unique" ON "_MenuItemToSearchTag"("A", "B");

-- CreateIndex
CREATE INDEX "_MenuItemToSearchTag_B_index" ON "_MenuItemToSearchTag"("B");
