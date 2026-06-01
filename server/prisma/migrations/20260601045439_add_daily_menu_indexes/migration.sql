-- CreateIndex
CREATE INDEX "DailyCategory_snapshotId_idx" ON "DailyCategory"("snapshotId");

-- CreateIndex
CREATE INDEX "DailyMenuItem_categoryId_idx" ON "DailyMenuItem"("categoryId");

-- CreateIndex
CREATE INDEX "DailyMenuItem_menuItemId_idx" ON "DailyMenuItem"("menuItemId");

-- CreateIndex
CREATE INDEX "DailyStation_cafeId_dateString_idx" ON "DailyStation"("cafeId", "dateString");

-- CreateIndex
CREATE INDEX "DailyStation_stationId_dateString_idx" ON "DailyStation"("stationId", "dateString");

-- CreateIndex
CREATE INDEX "DailyStation_snapshotId_idx" ON "DailyStation"("snapshotId");

-- CreateIndex
CREATE INDEX "DailyStation_dateString_idx" ON "DailyStation"("dateString");
