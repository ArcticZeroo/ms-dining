-- Per menu item, the distinct set of fiscal years it appeared on any menu.
-- BoD price levels (MS_<year>) take effect July 1, so July–December map to the
-- current year and January–June to the previous year. Computing the bucket in
-- SQL keeps the result set to (item x year) instead of every item-day.
SELECT DISTINCT
    DailyMenuItem.menuItemId AS menuItemId,
    CASE
        WHEN CAST(substr(DailyStation.dateString, 6, 2) AS INTEGER) >= 7
            THEN CAST(substr(DailyStation.dateString, 1, 4) AS INTEGER)
        ELSE CAST(substr(DailyStation.dateString, 1, 4) AS INTEGER) - 1
    END AS fiscalYear
FROM DailyMenuItem
INNER JOIN DailyCategory ON DailyMenuItem.categoryId = DailyCategory.id
INNER JOIN StationMenuSnapshot ON DailyCategory.snapshotId = StationMenuSnapshot.id
INNER JOIN DailyStation ON DailyStation.snapshotId = StationMenuSnapshot.id
