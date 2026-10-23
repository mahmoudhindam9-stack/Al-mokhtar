-- Never create a shared, publicly known administrator password.
-- A newly seeded account receives an unshared random password. Reset it from
-- the Supabase Dashboard before use. Existing passwords are not overwritten here.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  admin_id uuid := gen_random_uuid();
  generated_password text := encode(extensions.gen_random_bytes(32), 'hex');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@restocash.com') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud,
      confirmation_token
    ) VALUES (
      admin_id,
      '00000000-0000-0000-0000-000000000000',
      'admin@restocash.com',
      extensions.crypt(generated_password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"],"role":"admin"}',
      '{"full_name":"Super Admin"}',
      now(),
      now(),
      'authenticated',
      'authenticated',
      ''
    );

    INSERT INTO public.profiles (id, full_name, role, created_at, updated_at)
    VALUES (admin_id, 'Super Admin', 'admin', now(), now())
    ON CONFLICT (id) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          role = 'admin',
          updated_at = now();
  END IF;
END $$;
