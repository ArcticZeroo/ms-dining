-- CreateTable
CREATE TABLE "StationTheme" (
    "itemHash" TEXT NOT NULL PRIMARY KEY,
    "theme" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "StationTheme_itemHash_key" ON "StationTheme"("itemHash");
