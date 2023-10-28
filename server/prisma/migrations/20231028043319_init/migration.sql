-- CreateTable
CREATE TABLE "Cafe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "logoName" TEXT NOT NULL,
    "contextId" INTEGER NOT NULL,
    "displayProfileId" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "calories" INTEGER NOT NULL,
    "maxCalories" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "price" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "DailyCafe" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "cafeId" TEXT NOT NULL,
    CONSTRAINT "DailyCafe_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyStation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "stationId" TEXT NOT NULL,
    "cafeId" INTEGER NOT NULL,
    CONSTRAINT "DailyStation_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DailyStation_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "DailyCafe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyMenuItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "menuItemId" TEXT NOT NULL,
    "stationId" INTEGER NOT NULL,
    CONSTRAINT "DailyMenuItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DailyMenuItem_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "DailyStation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
