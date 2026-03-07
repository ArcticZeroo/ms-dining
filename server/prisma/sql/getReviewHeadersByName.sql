SELECT mi.normalizedName as normalizedName, COUNT(*) as reviewCount, AVG(r.rating) as averageRating
FROM Review r
INNER JOIN MenuItem mi ON r.menuItemId = mi.id
WHERE mi.groupId IS NULL
GROUP BY mi.normalizedName
