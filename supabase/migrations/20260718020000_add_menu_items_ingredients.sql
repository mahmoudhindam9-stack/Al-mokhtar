-- Add ingredients column to menu_items table
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS ingredients jsonb NOT NULL DEFAULT '[]'::jsonb;
