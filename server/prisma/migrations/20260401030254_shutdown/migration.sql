-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DailyCafe" (
    "dateString" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isShutDown" BOOLEAN NOT NULL DEFAULT false,
    "shutDownMessage" TEXT,
    "cafeId" TEXT NOT NULL,

    PRIMARY KEY ("dateString", "cafeId"),
    CONSTRAINT "DailyCafe_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DailyCafe" ("cafeId", "dateString", "isAvailable") SELECT "cafeId", "dateString", "isAvailable" FROM "DailyCafe";
DROP TABLE "DailyCafe";
ALTER TABLE "new_DailyCafe" RENAME TO "DailyCafe";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
