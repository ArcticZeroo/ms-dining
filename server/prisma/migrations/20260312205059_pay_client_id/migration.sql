DROP TABLE IF EXISTS "DailyCafeOrderingContext";
CREATE TABLE "DailyCafeOrderingContext" (
    "dateString" TEXT NOT NULL,
    "onDemandEmployeeId" TEXT NOT NULL,
    "onDemandTerminalId" TEXT NOT NULL,
    "profitCenterId" TEXT NOT NULL,
    "profitCenterName" TEXT NOT NULL,
    "storePriceLevel" TEXT NOT NULL,
    "payClientId" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,

    PRIMARY KEY ("dateString", "cafeId"),
    CONSTRAINT "DailyCafeOrderingContext_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
