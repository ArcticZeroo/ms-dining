SELECT MenuItem.id
FROM MenuItem
WHERE MenuItem.groupId IS NULL AND normalizedName IN (
  SELECT MenuItem.normalizedName
  FROM MenuItem
  WHERE MenuItem.groupId = :groupId
)