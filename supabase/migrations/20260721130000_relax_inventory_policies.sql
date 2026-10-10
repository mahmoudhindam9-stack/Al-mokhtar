-- Relax SELECT policies so any authenticated user can view the inventory, transactions, and tables.
-- This ensures cashiers, kitchen staff, and waiters can see stock levels and layout without errors.

-- 1. Inventory read access
DROP POLICY IF EXISTS "authenticated read inventory" ON public.inventory;
CREATE POLICY "authenticated read inventory" 
  ON public.inventory 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- 2. Inventory transactions read access
DROP POLICY IF EXISTS "authenticated read inventory_transactions" ON public.inventory_transactions;
CREATE POLICY "authenticated read inventory_transactions" 
  ON public.inventory_transactions 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- 3. Tables read access
DROP POLICY IF EXISTS "authenticated read tables" ON public.tables;
CREATE POLICY "authenticated read tables" 
  ON public.tables 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- 4. Profiles read access (allow authenticated users to view profiles)
DROP POLICY IF EXISTS "profiles select" ON public.profiles;
CREATE POLICY "profiles select" 
  ON public.profiles 
  FOR SELECT 
  TO authenticated 
  USING (true);
