SELECT mi.groupId as groupId, COUNT(*) as reviewCount, AVG(r.rating) as averageRating
FROM Review r
INNER JOIN MenuItem mi ON r.menuItemId = mi.id
WHERE mi.groupId IS NOT NULL
GROUP BY mi.groupId
