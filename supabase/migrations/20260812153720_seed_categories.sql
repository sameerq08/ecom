-- Step 03: the fixed v1 category set, mirroring lib/data/categories.ts so the
-- step 04 data swap has one category vocabulary rather than two.
insert into public.categories (name, slug) values
  ('Electronics', 'electronics'),
  ('Home & Kitchen', 'home-kitchen'),
  ('Clothing & Accessories', 'clothing-accessories'),
  ('Books', 'books'),
  ('Beauty & Personal Care', 'beauty-personal-care'),
  ('Sports & Outdoors', 'sports-outdoors'),
  ('Toys & Games', 'toys-games')
on conflict (slug) do nothing;
