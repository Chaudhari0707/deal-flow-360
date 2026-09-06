UPDATE "products"
SET "paired_product_ids" = CASE
  WHEN jsonb_typeof("paired_product_ids") = 'array' THEN COALESCE(
    (
      SELECT jsonb_agg(entry.value ORDER BY entry.ordinality)
      FROM jsonb_array_elements("paired_product_ids") WITH ORDINALITY AS entry(value, ordinality)
      WHERE entry.ordinality <= 5
    ),
    '[]'::jsonb
  )
  ELSE '[]'::jsonb
END
WHERE CASE
  WHEN jsonb_typeof("paired_product_ids") = 'array' THEN jsonb_array_length("paired_product_ids")
  ELSE 6
END > 5;
--> statement-breakpoint
DELETE FROM "settings" WHERE "id" = 'upsell';
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "product_upsell_limit" CHECK (jsonb_typeof("products"."paired_product_ids") = 'array' AND jsonb_array_length("products"."paired_product_ids") <= 5);
