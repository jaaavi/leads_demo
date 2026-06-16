-- Check places without web
-- This script verifies how many places have no web (NULL or empty)

-- 1. Count of places WITHOUT web (NULL or empty)
SELECT COUNT(*) as total_places_without_web
FROM places
WHERE web IS NULL OR web = '';

-- 2. Percentage of places without web
SELECT 
  ROUND((COUNT(*) * 100.0) / (SELECT COUNT(*) FROM places), 2) as percentage_without_web
FROM places
WHERE web IS NULL OR web = '';

-- 3. Breakdown by status
SELECT 
  CASE 
    WHEN web IS NULL THEN 'NULL'
    WHEN web = '' THEN 'Empty String'
    ELSE 'Has Web'
  END as web_status,
  COUNT(*) as count,
  ROUND((COUNT(*) * 100.0) / (SELECT COUNT(*) FROM places), 2) as percentage
FROM places
GROUP BY web_status;

-- 4. Sample of places without web (limit 20)
SELECT 
  id,
  name,
  main_category,
  city,
  phone,
  web,
  created_at
FROM places
WHERE web IS NULL OR web = ''
ORDER BY created_at DESC
LIMIT 20;

-- 5. Count by category for places without web
SELECT 
  COALESCE(main_category, 'No Category') as category,
  COUNT(*) as count_without_web
FROM places
WHERE web IS NULL OR web = ''
GROUP BY main_category
ORDER BY count_without_web DESC
LIMIT 15;

-- 6. Count by city for places without web (top 15)
SELECT 
  COALESCE(city, 'No City') as city,
  COUNT(*) as count_without_web
FROM places
WHERE web IS NULL OR web = ''
GROUP BY city
ORDER BY count_without_web DESC
LIMIT 15;

-- 7. Total statistics
SELECT 
  (SELECT COUNT(*) FROM places) as total_places,
  (SELECT COUNT(*) FROM places WHERE web IS NOT NULL AND web <> '') as places_with_web,
  (SELECT COUNT(*) FROM places WHERE web IS NULL OR web = '') as places_without_web,
  ROUND(((SELECT COUNT(*) FROM places WHERE web IS NULL OR web = '') * 100.0) / (SELECT COUNT(*) FROM places), 2) as percentage_without_web;
