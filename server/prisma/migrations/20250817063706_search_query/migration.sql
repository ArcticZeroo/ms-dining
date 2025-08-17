-- CreateTable
CREATE TABLE "SearchQuery" (
    "query" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
