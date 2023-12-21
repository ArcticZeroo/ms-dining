-- AlterTable
ALTER TABLE "DailyStation" ADD COLUMN "externalLastUpdateTime" DATETIME;

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN "tags" TEXT;

-- CreateTable
CREATE TABLE "MenuItemTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);
