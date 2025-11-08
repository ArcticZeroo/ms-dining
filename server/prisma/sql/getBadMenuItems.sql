SELECT MenuItem.name, MenuItem.id, MenuItem.stationId FROM MenuItem
LEFT JOIN Station ON MenuItem.stationId = Station.id
WHERE Station.id IS NULL;