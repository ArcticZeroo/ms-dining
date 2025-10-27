SELECT MenuItem.id
FROM MenuItem
WHERE MenuItem.groupId IS NULL AND normalizedName IN (
  SELECT normalizedName
  FROM MenuItem
  GROUP BY normalizedName
  HAVING COUNT(*) > 1
)