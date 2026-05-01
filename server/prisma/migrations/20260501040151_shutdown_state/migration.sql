/*
  Warnings:

  - You are about to drop the column `isShutDown` on the `DailyCafe` table. All the data in the column will be lost.
  - You are about to drop the column `shutDownMessage` on the `DailyCafe` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "CafeShutdown" (
    "messageHash" TEXT NOT NULL PRIMARY KEY,
    "message" TEXT NOT NULL,
    "shutdownType" TEXT NOT NULL DEFAULT 'full',
    "isTemporary" BOOLEAN NOT NULL DEFAULT false,
    "resumeInfo" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DailyCafe" (
    "dateString" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "cafeId" TEXT NOT NULL,
    "shutdownMessageHash" TEXT,

    PRIMARY KEY ("dateString", "cafeId"),
    CONSTRAINT "DailyCafe_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailyCafe_shutdownMessageHash_fkey" FOREIGN KEY ("shutdownMessageHash") REFERENCES "CafeShutdown" ("messageHash") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DailyCafe" ("cafeId", "dateString", "isAvailable") SELECT "cafeId", "dateString", "isAvailable" FROM "DailyCafe";
DROP TABLE "DailyCafe";
ALTER TABLE "new_DailyCafe" RENAME TO "DailyCafe";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
