-- Migration: Add inventory_tracking column to public.menu_items
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS inventory_tracking text NOT NULL DEFAULT 'not_tracked';

-- Automatically set existing items with recipes to 'recipe_required'
UPDATE public.menu_items mi
SET inventory_tracking = 'recipe_required'
WHERE EXISTS (
  SELECT 1 FROM public.recipes r WHERE r.menu_item_id = mi.id
);

-- Notify PostgREST schema cache to reload schema
NOTIFY pgrst, 'reload schema';
