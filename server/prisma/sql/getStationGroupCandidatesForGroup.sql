SELECT Station.id, lower(Station.name) as name
FROM Station
WHERE Station.groupId IS NULL AND lower(name) IN (
  SELECT lower(name)
  FROM Station
  WHERE Station.groupId = :groupId
)