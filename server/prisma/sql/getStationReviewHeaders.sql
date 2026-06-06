-- Aggregate review counts and average rating per station entityKey.
-- Used to populate the in-memory station review header cache on startup.
SELECT
    s.entityKey AS "entityKey",
    COUNT(*) AS "reviewCount",
    AVG(r.rating) AS "averageRating"
FROM Review r
JOIN Station s ON s.id = r.stationId
WHERE r.stationId IS NOT NULL
GROUP BY s.entityKey
