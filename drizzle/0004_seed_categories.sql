-- Seed the admin-managed category list (spec §5.1). Idempotent: an admin
-- may have renamed or deactivated a category; any clash (id, name or slug)
-- leaves the existing row alone.
INSERT INTO "categories" ("id", "name", "slug", "sort_order") VALUES
  ('cat_regional_packaged_food', 'Regional packaged food', 'regional-packaged-food', 10),
  ('cat_snacks_and_sweets', 'Snacks and sweets', 'snacks-and-sweets', 20),
  ('cat_cashews_and_dry_fruits', 'Cashews and dry fruits', 'cashews-and-dry-fruits', 30),
  ('cat_art_and_handicrafts', 'Art and handicrafts', 'art-and-handicrafts', 40),
  ('cat_home_and_festive_decor', 'Home and festive decor', 'home-and-festive-decor', 50),
  ('cat_handmade_gifts', 'Handmade gifts', 'handmade-gifts', 60),
  ('cat_other_regional_products', 'Other regional products', 'other-regional-products', 70)
ON CONFLICT DO NOTHING;
