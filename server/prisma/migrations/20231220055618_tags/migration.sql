-- AlterTable
ALTER TABLE "DailyStation" ADD COLUMN "externalLastUpdateTime" DATETIME;

-- CreateTable
CREATE TABLE "MenuItemTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT
);

-- CreateTable
CREATE TABLE "_MenuItemToMenuItemTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_MenuItemToMenuItemTag_A_fkey" FOREIGN KEY ("A") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_MenuItemToMenuItemTag_B_fkey" FOREIGN KEY ("B") REFERENCES "MenuItemTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_MenuItemToMenuItemTag_AB_unique" ON "_MenuItemToMenuItemTag"("A", "B");

-- CreateIndex
CREATE INDEX "_MenuItemToMenuItemTag_B_index" ON "_MenuItemToMenuItemTag"("B");
