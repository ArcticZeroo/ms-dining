SELECT MenuItem.id
FROM MenuItem
WHERE normalizedName IN (
  SELECT normalizedName
  FROM MenuItem
  GROUP BY normalizedName
  HAVING COUNT(*) > 1
)