SELECT s.normalizedName as normalizedName, COUNT(*) as reviewCount, AVG(r.rating) as averageRating
FROM Review r
INNER JOIN Station s ON r.stationId = s.id
WHERE s.groupId IS NULL
GROUP BY s.normalizedName
