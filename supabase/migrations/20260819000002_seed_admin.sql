-- Enable pgcrypto for the crypt() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  admin_id uuid := gen_random_uuid();
BEGIN
  -- Check if admin user already exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@restocash.com') THEN
    
    -- Create the admin user in auth.users with password '123456'
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
      extensions.crypt('123456', extensions.gen_salt('bf')), 
      now(), 
      '{"provider":"email","providers":["email"]}', 
      '{"role":"admin","full_name":"Super Admin"}', 
      now(), 
      now(), 
      'authenticated', 
      'authenticated', 
      ''
    );

    -- Insert the corresponding profile
    INSERT INTO public.profiles (id, full_name, role, created_at, updated_at)
    VALUES (admin_id, 'Super Admin', 'admin', now(), now());
    
  ELSE
    -- If the user exists, force update their password to '123456' and role to 'admin'
    UPDATE auth.users
    SET encrypted_password = extensions.crypt('123456', extensions.gen_salt('bf'))
    WHERE email = 'admin@restocash.com';
    
    UPDATE public.profiles
    SET role = 'admin'
    WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@restocash.com');
  END IF;
END $$;
