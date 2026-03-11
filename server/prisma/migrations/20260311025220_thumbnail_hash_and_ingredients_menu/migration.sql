-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN "thumbnailHash" TEXT;

-- CreateTable
CREATE TABLE "IngredientsMenuRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menuItemId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "menuHash" TEXT NOT NULL,
    CONSTRAINT "IngredientsMenuRole_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "IngredientsMenuRole_menuItemId_menuHash_key" ON "IngredientsMenuRole"("menuItemId", "menuHash");
