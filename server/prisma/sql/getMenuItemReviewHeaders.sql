-- Aggregate review counts and average rating per menu-item entityKey.
-- Used to populate the in-memory review header cache on startup.
SELECT
    mi.entityKey AS "entityKey",
    COUNT(*) AS "reviewCount",
    AVG(r.rating) AS "averageRating"
FROM Review r
JOIN MenuItem mi ON mi.id = r.menuItemId
WHERE r.menuItemId IS NOT NULL
GROUP BY mi.entityKey
