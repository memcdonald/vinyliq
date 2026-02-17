-- Clean up pre-existing junk suggestions:
-- 1. "Unknown Artist" entries from unparsed RSS/HTML items
-- 2. Low-quality entries that predate the quality threshold
DELETE FROM "ai_suggestions"
WHERE
  LOWER("artist_name") = 'unknown artist'
  OR ("combined_score" < 4 AND "taste_score" < 6);
