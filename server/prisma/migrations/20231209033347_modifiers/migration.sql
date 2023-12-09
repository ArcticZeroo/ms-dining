-- CreateTable
CREATE TABLE "MenuItemModifier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "minimum" INTEGER NOT NULL,
    "maximum" INTEGER NOT NULL,
    "choiceType" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    CONSTRAINT "MenuItemModifier_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MenuItemModifierChoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "modifierId" TEXT NOT NULL,
    CONSTRAINT "MenuItemModifierChoice_modifierId_fkey" FOREIGN KEY ("modifierId") REFERENCES "MenuItemModifier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
