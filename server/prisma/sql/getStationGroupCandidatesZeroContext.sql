SELECT Station.id, lower(Station.name) as name
FROM Station
WHERE Station.groupId is NULL AND lower(name) IN (
  SELECT lower(name)
  FROM Station
  GROUP BY lower(name)
  HAVING COUNT(*) > 1
)