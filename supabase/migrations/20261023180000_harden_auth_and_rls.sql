-- Security hardening for hosted Al-Mokhtar.
-- Removes the temporary public RLS bypass, restores role checks, closes
-- public first-admin enrollment, and invalidates the known weak seed password.
BEGIN;

-- The old temporary development migration opened every listed table to anon.
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "TEMP_DEV_ALL_inventory" ON public.inventory;
DROP POLICY IF EXISTS "TEMP_DEV_ALL_inventory_transactions" ON public.inventory_transactions;
DROP POLICY IF EXISTS "TEMP_DEV_ALL_recipes" ON public.recipes;
DROP POLICY IF EXISTS "TEMP_DEV_ALL_recipe_ingredients" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "TEMP_DEV_ALL_menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "TEMP_DEV_ALL_categories" ON public.categories;
DROP POLICY IF EXISTS "TEMP_DEV_ALL_orders" ON public.orders;
DROP POLICY IF EXISTS "TEMP_DEV_ALL_tables" ON public.tables;
DROP POLICY IF EXISTS "TEMP_DEV_ALL_profiles" ON public.profiles;

-- Restore authorization helpers. Fixed search_path prevents object-shadowing.
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff() RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT auth.role() = 'authenticated';
$$;

-- Read the caller's existing role without recursively applying profiles RLS.
CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_manager_or_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- Revoke all anonymous/public table grants added by the dev bypass.
REVOKE ALL PRIVILEGES ON TABLE
  public.inventory,
  public.inventory_transactions,
  public.recipes,
  public.recipe_ingredients,
  public.menu_items,
  public.categories,
  public.orders,
  public.tables,
  public.profiles
FROM anon, PUBLIC;

-- Keep table privileges for signed-in users; RLS policies below decide what they can do.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.inventory,
  public.inventory_transactions,
  public.recipes,
  public.recipe_ingredients,
  public.menu_items,
  public.categories,
  public.orders,
  public.tables,
  public.profiles
TO authenticated;

GRANT ALL PRIVILEGES ON TABLE
  public.inventory,
  public.inventory_transactions,
  public.recipes,
  public.recipe_ingredients,
  public.menu_items,
  public.categories,
  public.orders,
  public.tables,
  public.profiles
TO service_role;

-- Remove public order access and public table reads. ERP data requires a session.
DROP POLICY IF EXISTS "public create orders" ON public.orders;
DROP POLICY IF EXISTS "public read orders" ON public.orders;
DROP POLICY IF EXISTS "anon read tables" ON public.tables;
DROP POLICY IF EXISTS "profiles select" ON public.profiles;
DROP POLICY IF EXISTS "profiles insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles update" ON public.profiles;
DROP POLICY IF EXISTS "profiles delete" ON public.profiles;

CREATE POLICY "profiles select"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin() OR auth.uid() = id);

-- New accounts cannot assign themselves privileged roles from user metadata.
CREATE POLICY "profiles insert"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR (auth.uid() = id AND role = 'cashier'));

-- A user may edit their own profile, but cannot change their own role.
CREATE POLICY "profiles update"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin() OR auth.uid() = id)
  WITH CHECK (public.is_admin() OR (
    auth.uid() = id AND role = public.current_user_role()
  ));

CREATE POLICY "profiles delete"
  ON public.profiles FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "authenticated read orders"
  ON public.orders FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY "authenticated create orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "authenticated read categories" ON public.categories;
DROP POLICY IF EXISTS "manager admin manage categories" ON public.categories;
CREATE POLICY "authenticated read categories"
  ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "manager admin manage categories"
  ON public.categories FOR ALL TO authenticated
  USING (public.is_manager_or_admin())
  WITH CHECK (public.is_manager_or_admin());

-- Remove public access to order identifiers and privileged/testing RPCs.
REVOKE ALL ON SEQUENCE public.orders_order_number_seq FROM anon, PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE public.orders_order_number_seq TO authenticated;
GRANT ALL ON SEQUENCE public.orders_order_number_seq TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_count() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_count() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.start_order_preparing(uuid, boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_order(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_order_inventory(uuid, boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reverse_order_inventory(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_order_preparing(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_order_inventory(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_order_inventory(uuid) TO authenticated;

-- This test RPC writes and deletes production-shaped data; never expose it to end users.
REVOKE EXECUTE ON FUNCTION public.run_e2e_inventory_test() FROM anon, PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.run_e2e_inventory_test() TO service_role;

-- Do not let public sign-up metadata choose the profile role. Provision the first
-- admin explicitly in Supabase Dashboard after applying this migration.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    'cashier'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Promote the legacy seeded admin in server-controlled app_metadata. If its
-- password is still the known seed value, replace it with an unshared random
-- value so the public default credential cannot log in anymore.
DO $$
DECLARE
  v_admin_id uuid;
  v_password_hash text;
  v_temporary_password text;
BEGIN
  SELECT id, encrypted_password
    INTO v_admin_id, v_password_hash
  FROM auth.users
  WHERE email = 'admin@restocash.com'
  LIMIT 1;

  IF v_admin_id IS NOT NULL THEN
    IF v_password_hash IS NOT NULL
       AND extensions.crypt('123456', v_password_hash) = v_password_hash THEN
      v_temporary_password := encode(extensions.gen_random_bytes(32), 'hex');
      UPDATE auth.users
      SET encrypted_password = extensions.crypt(v_temporary_password, extensions.gen_salt('bf')),
          raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
            || jsonb_build_object('role', 'admin'),
          updated_at = now()
      WHERE id = v_admin_id;
    ELSE
      UPDATE auth.users
      SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
            || jsonb_build_object('role', 'admin'),
          updated_at = now()
      WHERE id = v_admin_id;
    END IF;

    UPDATE public.profiles SET role = 'admin', updated_at = now()
    WHERE id = v_admin_id;
  END IF;
END $$;

COMMIT;
