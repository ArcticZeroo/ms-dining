-- Aggregate completed-order item counts per menu-item entityKey for one user.
--
-- Counts CafeOrderItem rows (one per distinct line item in an order); used by
-- the UI to badge menu items the user has previously ordered. Includes items
-- from incomplete groupings via MenuItem.entityKey, so the same item served
-- at multiple cafes collapses to a single count.
SELECT
    mi.entityKey AS "entityKey",
    COUNT(*) AS "orderCount"
FROM CafeOrderItem ci
JOIN CafeOrder co ON co.id = ci.cafeOrderId
JOIN MenuItem mi ON mi.id = ci.menuItemId
WHERE co.userId = :userId
GROUP BY mi.entityKey
