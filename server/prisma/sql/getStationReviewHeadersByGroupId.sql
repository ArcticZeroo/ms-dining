SELECT s.groupId as groupId, COUNT(*) as reviewCount, AVG(r.rating) as averageRating
FROM Review r
INNER JOIN Station s ON r.stationId = s.id
WHERE s.groupId IS NOT NULL
GROUP BY s.groupId
