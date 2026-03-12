/*
  Warnings:

  - The primary key for the `MenuItemModifierChoice` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MenuItemModifierChoice" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "modifierId" TEXT NOT NULL,

    PRIMARY KEY ("id", "modifierId"),
    CONSTRAINT "MenuItemModifierChoice_modifierId_fkey" FOREIGN KEY ("modifierId") REFERENCES "MenuItemModifier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MenuItemModifierChoice" ("description", "id", "modifierId", "price") SELECT "description", "id", "modifierId", "price" FROM "MenuItemModifierChoice";
DROP TABLE "MenuItemModifierChoice";
ALTER TABLE "new_MenuItemModifierChoice" RENAME TO "MenuItemModifierChoice";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
