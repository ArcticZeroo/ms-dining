/*
  Warnings:

  - You are about to drop the `_MenuItemToMenuItemModifier` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_MenuItemToMenuItemModifier";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "MenuItemModifierEntry" (
    "modifierId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,

    PRIMARY KEY ("modifierId", "menuItemId"),
    CONSTRAINT "MenuItemModifierEntry_modifierId_fkey" FOREIGN KEY ("modifierId") REFERENCES "MenuItemModifier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MenuItemModifierEntry_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
