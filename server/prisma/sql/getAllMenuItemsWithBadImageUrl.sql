SELECT MenuItem.id, MenuItem.imageUrl, MenuItem.cafeId FROM MenuItem
WHERE MenuItem.imageUrl IS NOT NULL AND
      (NOT (MenuItem.imageUrl LIKE 'http://%') AND
       NOT (MenuItem.imageUrl LIKE 'https://%'))