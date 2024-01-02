/*
  Warnings:

  - Added the required column `onDemandEmployeeId` to the `DailyCafeOrderingContext` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DailyCafeOrderingContext" (
    "dateString" TEXT NOT NULL,
    "onDemandEmployeeId" TEXT NOT NULL,
    "onDemandTerminalId" TEXT NOT NULL,
    "profitCenterId" TEXT NOT NULL,
    "storePriceLevel" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,

    PRIMARY KEY ("dateString", "cafeId"),
    CONSTRAINT "DailyCafeOrderingContext_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DailyCafeOrderingContext" ("cafeId", "dateString", "onDemandTerminalId", "profitCenterId", "storePriceLevel") SELECT "cafeId", "dateString", "onDemandTerminalId", "profitCenterId", "storePriceLevel" FROM "DailyCafeOrderingContext";
DROP TABLE "DailyCafeOrderingContext";
ALTER TABLE "new_DailyCafeOrderingContext" RENAME TO "DailyCafeOrderingContext";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
