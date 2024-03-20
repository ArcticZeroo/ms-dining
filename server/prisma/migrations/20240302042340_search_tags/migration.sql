-- CreateTable
CREATE TABLE "SearchTag" (
    "name" TEXT NOT NULL PRIMARY KEY
);

-- CreateTable
CREATE TABLE "_MenuItemToSearchTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_MenuItemToSearchTag_A_fkey" FOREIGN KEY ("A") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_MenuItemToSearchTag_B_fkey" FOREIGN KEY ("B") REFERENCES "SearchTag" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SearchTag_name_key" ON "SearchTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_MenuItemToSearchTag_AB_unique" ON "_MenuItemToSearchTag"("A", "B");

-- CreateIndex
CREATE INDEX "_MenuItemToSearchTag_B_index" ON "_MenuItemToSearchTag"("B");
