/*
  Warnings:

  - A unique constraint covering the columns `[orderSessionId,cafeId]` on the table `OrderCafePart` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "OrderCafePart_orderSessionId_cafeId_key" ON "OrderCafePart"("orderSessionId", "cafeId");
