SELECT DailyMenuItem.menuItemId, MIN(DailyStation.dateString) as firstAppearance FROM DailyMenuItem
INNER JOIN DailyCategory ON DailyMenuItem.categoryId=DailyCategory.id
INNER JOIN StationMenuSnapshot ON DailyCategory.snapshotId=StationMenuSnapshot.id
INNER JOIN DailyStation ON DailyStation.snapshotId=StationMenuSnapshot.id
GROUP BY DailyMenuItem.menuItemId