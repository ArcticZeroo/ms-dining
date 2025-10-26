SELECT Station.id, lower(Station.name) as name
FROM Station
WHERE lower(name) IN (
  SELECT lower(name)
  FROM Station
  GROUP BY lower(name)
  HAVING COUNT(*) > 1
)