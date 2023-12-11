-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN "externalLastUpdateTime" DATETIME;

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
CREATE TABLE "_MenuItemToMenuItemModifier" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_MenuItemToMenuItemModifier_A_fkey" FOREIGN KEY ("A") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_MenuItemToMenuItemModifier_B_fkey" FOREIGN KEY ("B") REFERENCES "MenuItemModifier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_MenuItemToMenuItemModifier_AB_unique" ON "_MenuItemToMenuItemModifier"("A", "B");

-- CreateIndex
CREATE INDEX "_MenuItemToMenuItemModifier_B_index" ON "_MenuItemToMenuItemModifier"("B");
