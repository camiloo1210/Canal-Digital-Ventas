-- Package weight (grams) and dimensions (mm) used to build carrier shipments.
-- All-or-nothing: either the four values are set or none of them.
ALTER TABLE catalog.products
  ADD COLUMN weight_grams integer CHECK (weight_grams IS NULL OR weight_grams > 0),
  ADD COLUMN length_mm integer CHECK (length_mm IS NULL OR length_mm > 0),
  ADD COLUMN width_mm integer CHECK (width_mm IS NULL OR width_mm > 0),
  ADD COLUMN height_mm integer CHECK (height_mm IS NULL OR height_mm > 0),
  ADD CONSTRAINT products_package_data_all_or_none CHECK (
    (weight_grams IS NULL AND length_mm IS NULL AND width_mm IS NULL AND height_mm IS NULL)
    OR (weight_grams IS NOT NULL AND length_mm IS NOT NULL AND width_mm IS NOT NULL AND height_mm IS NOT NULL)
  );
