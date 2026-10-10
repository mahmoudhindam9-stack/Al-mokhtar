-- Fix the seeded hosted administrator claim without changing the existing password.
-- Supabase exposes raw_app_meta_data as auth.user.app_metadata in JWT claims.
-- The previous seed migration only stored the role inside raw_user_meta_data.
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  SELECT id
    INTO admin_user_id
  FROM auth.users
  WHERE lower(email) = 'admin@restocash.com'
  ORDER BY created_at
  LIMIT 1;

  IF admin_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET raw_app_meta_data =
      COALESCE(raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object(
        'role', 'admin',
        'provider', COALESCE(raw_app_meta_data->>'provider', 'email'),
        'providers', COALESCE(raw_app_meta_data->'providers', '["email"]'::jsonb)
      ),
      updated_at = now()
    WHERE id = admin_user_id;

    UPDATE public.profiles
    SET role = 'admin',
        updated_at = now()
    WHERE id = admin_user_id;
  END IF;
END
$$;
