SELECT Station.id, Station.logoUrl, Station.cafeId FROM Station
WHERE Station.logoUrl IS NOT NULL AND
      (NOT (Station.logoUrl LIKE 'http://%') AND
       NOT (Station.logoUrl LIKE 'https://%'))