-- Staff profiles & roles (must be created before helper functions that reference it)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  role text NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin','manager','cashier','kitchen')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper functions for role checks (SECURITY DEFINER so they can read profiles without RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean AS $$
  SELECT COALESCE((SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()), false);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin() RETURNS boolean AS $$
  SELECT COALESCE((SELECT role IN ('admin','manager') FROM public.profiles WHERE id = auth.uid()), false);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_staff() RETURNS boolean AS $$
  SELECT auth.role() = 'authenticated';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.admin_count() RETURNS bigint AS $$
  SELECT count(*) FROM public.profiles WHERE role = 'admin';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_count() TO anon, authenticated;

-- Profiles policies
DROP POLICY IF EXISTS "public manage profiles" ON public.profiles;
CREATE POLICY "profiles select" ON public.profiles FOR SELECT TO authenticated USING (is_admin() OR auth.uid() = id);
CREATE POLICY "profiles insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (is_admin() OR auth.uid() = id);
CREATE POLICY "profiles update" ON public.profiles FOR UPDATE TO authenticated USING (is_admin() OR auth.uid() = id) WITH CHECK (is_admin() OR auth.uid() = id);
CREATE POLICY "profiles delete" ON public.profiles FOR DELETE TO authenticated USING (is_admin());

-- Tables / sections for restaurant floor
CREATE TABLE IF NOT EXISTS public.tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number int NOT NULL UNIQUE,
  name text,
  capacity int NOT NULL DEFAULT 4,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','occupied','reserved','cleaning')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tables TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tables TO authenticated;
GRANT ALL ON public.tables TO service_role;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public manage tables" ON public.tables;
CREATE POLICY "anon read tables" ON public.tables FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated read tables" ON public.tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "manager admin manage tables" ON public.tables FOR ALL TO authenticated USING (is_manager_or_admin()) WITH CHECK (is_manager_or_admin());

-- Inventory / stock
CREATE TABLE IF NOT EXISTS public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  unit text NOT NULL DEFAULT 'pcs',
  quantity numeric(10,2) NOT NULL DEFAULT 0,
  min_level numeric(10,2) NOT NULL DEFAULT 0,
  cost numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inventory TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.inventory TO authenticated;
GRANT ALL ON public.inventory TO service_role;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public manage inventory" ON public.inventory;
CREATE POLICY "manager admin manage inventory" ON public.inventory FOR ALL TO authenticated USING (is_manager_or_admin()) WITH CHECK (is_manager_or_admin());

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('in','out','adjustment')),
  quantity numeric(10,2) NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_transactions TO authenticated;
GRANT ALL ON public.inventory_transactions TO service_role;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public manage inventory_transactions" ON public.inventory_transactions;
CREATE POLICY "manager admin manage inventory_transactions" ON public.inventory_transactions FOR ALL TO authenticated USING (is_manager_or_admin()) WITH CHECK (is_manager_or_admin());

-- Extend orders with status, table and order type
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS table_id uuid REFERENCES public.tables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','preparing','ready','served','cancelled')),
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'dine_in' CHECK (order_type IN ('dine_in','takeaway','delivery')),
  ADD COLUMN IF NOT EXISTS notes text;

-- Make sure anon cannot update/delete orders (it can still place orders via INSERT)
REVOKE UPDATE, DELETE ON public.orders FROM anon;
GRANT UPDATE, DELETE ON public.orders TO authenticated;
DROP POLICY IF EXISTS "public update orders" ON public.orders;
DROP POLICY IF EXISTS "public delete orders" ON public.orders;
CREATE POLICY "authenticated update orders" ON public.orders FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
CREATE POLICY "admin delete orders" ON public.orders FOR DELETE TO authenticated USING (is_admin());

-- Allow authenticated managers/admins to manage the menu
GRANT INSERT, UPDATE, DELETE ON public.menu_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
DROP POLICY IF EXISTS "authenticated manage categories" ON public.menu_categories;
DROP POLICY IF EXISTS "authenticated manage items" ON public.menu_items;
CREATE POLICY "authenticated manage categories" ON public.menu_categories FOR ALL TO authenticated USING (is_manager_or_admin()) WITH CHECK (is_manager_or_admin());
CREATE POLICY "authenticated manage items" ON public.menu_items FOR ALL TO authenticated USING (is_manager_or_admin()) WITH CHECK (is_manager_or_admin());

-- Trigger to auto-create a profile when a new auth user is created.
-- The first user (no existing admin) is promoted to admin automatically.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger AS $$
DECLARE
  assigned_role text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin') THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := COALESCE(new.raw_user_meta_data->>'role', 'cashier');
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'phone',
    assigned_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed sample tables
INSERT INTO public.tables (number, name, capacity, status) VALUES
  (1, 'طاولة 1', 4, 'available'),
  (2, 'طاولة 2', 4, 'available'),
  (3, 'طاولة 3', 6, 'available'),
  (4, 'طاولة 4', 2, 'available'),
  (5, 'طاولة 5', 4, 'available')
ON CONFLICT (number) DO NOTHING;

-- Seed sample inventory
INSERT INTO public.inventory (name_ar, unit, quantity, min_level, cost) VALUES
  ('لحم مفروم', 'كجم', 10, 2, 120),
  ('دجاج', 'كجم', 15, 3, 90),
  ('خبز برجر', 'قطعة', 100, 20, 2.5),
  ('بطاطس', 'كجم', 20, 5, 15),
  ('جبنة موزاريلا', 'كجم', 5, 1, 85),
  ('كوكاكولا', 'علبة', 50, 10, 8),
  ('أرز', 'كجم', 25, 5, 12)
ON CONFLICT DO NOTHING;
