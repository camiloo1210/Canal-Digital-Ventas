-- Product image gallery (storefront carousel). image_url stays as the cover (first gallery image).
-- Legacy rows keep an empty gallery; readers fall back to image_url, so no data rewrite is needed.
ALTER TABLE catalog.products
  ADD COLUMN IF NOT EXISTS gallery_urls TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE catalog.products
  DROP CONSTRAINT IF EXISTS chk_products_gallery_size;
ALTER TABLE catalog.products
  ADD CONSTRAINT chk_products_gallery_size CHECK (cardinality(gallery_urls) <= 8);
