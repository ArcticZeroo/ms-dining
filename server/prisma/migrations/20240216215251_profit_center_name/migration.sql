/*
  Warnings:

  - Added the required column `profitCenterName` to the `DailyCafeOrderingContext` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
DROP TABLE "DailyCafeOrderingContext";
CREATE TABLE "DailyCafeOrderingContext" (
    "dateString" TEXT NOT NULL,
    "onDemandEmployeeId" TEXT NOT NULL,
    "onDemandTerminalId" TEXT NOT NULL,
    "profitCenterId" TEXT NOT NULL,
    "profitCenterName" TEXT NOT NULL,
    "storePriceLevel" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,

    PRIMARY KEY ("dateString", "cafeId"),
    CONSTRAINT "DailyCafeOrderingContext_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
