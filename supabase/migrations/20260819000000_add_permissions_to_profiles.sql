ALTER TABLE public.profiles ADD COLUMN permissions jsonb DEFAULT '{}'::jsonb;
