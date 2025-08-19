SELECT DailyMenuItem.menuItemId, MIN(DailyStation.dateString) as firstAppearance FROM DailyMenuItem
INNER JOIN DailyCategory ON DailyMenuItem.categoryId=DailyCategory.id
INNER JOIN DailyStation ON DailyCategory.stationId=DailyStation.id
GROUP BY DailyMenuItem.menuItemId