-- Centralize hosted usernames and ACL permissions in public.profiles.
-- The users page becomes the source of truth for application access.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Remove legacy Auth identities that are NOT present in the current Users page.
-- Profiles already visible in the Users page are preserved, including the active administrator.
-- This is intentionally a one-time purge: old orphaned accounts must be recreated from the
-- Users page with a role and explicit permissions before they can access the ERP.
DELETE FROM auth.users u
WHERE lower(split_part(coalesce(u.email, ''), '@', 2))
      IN ('restocash.local', 'almokhtar.local', 'mokhtar.local', 'restocash.com')
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = u.id
  );

-- Backfill usernames from existing profile values, auth metadata, or the login email.
WITH source_rows AS (
  SELECT
    p.id,
    lower(trim(coalesce(
      nullif(p.username, ''),
      nullif(u.raw_user_meta_data ->> 'username', ''),
      split_part(coalesce(u.email, ''), '@', 1),
      'user'
    ))) AS base_username,
    p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
),
ranked AS (
  SELECT
    id,
    base_username,
    row_number() OVER (PARTITION BY base_username ORDER BY created_at NULLS LAST, id) AS rn
  FROM source_rows
)
UPDATE public.profiles p
SET username = CASE
  WHEN ranked.rn = 1 THEN ranked.base_username
  ELSE ranked.base_username || '_' || right(replace(ranked.id::text, '-', ''), 6)
END
FROM ranked
WHERE ranked.id = p.id
  AND (p.username IS NULL OR trim(p.username) = '' OR p.username <> CASE
    WHEN ranked.rn = 1 THEN ranked.base_username
    ELSE ranked.base_username || '_' || right(replace(ranked.id::text, '-', ''), 6)
  END);

-- Populate conservative role defaults for existing profiles that predate the central ACL.
-- Explicitly configured permission JSON is never overwritten.
UPDATE public.profiles
SET permissions = CASE
  WHEN role IN ('admin', 'super_admin') THEN jsonb_build_object(
    'orders', true, 'pos', true, 'captain', true, 'kitchen', true, 'delivery', true,
    'inventory', true, 'hr', true, 'purchasing', true, 'production', true,
    'treasury', true, 'accounting', true, 'journal_approval', true,
    'expense_approval', true, 'revenue_approval', true, 'reports', true,
    'cost_centers', true, 'branch_mgmt', true, 'audit_logs', true, 'users_roles', true,
    'super_admin_full_access', true, 'system_manage_users', true, 'system_backup_update', true,
    'maintenance_view', true, 'maintenance_manage_requests', true, 'maintenance_manage_preventive', true,
    'maintenance_manage_custody', true, 'maintenance_post_finance', true, 'maintenance_manage_buildings', true,
    'maintenance_export_reports', true, 'mall_manage_shops', true, 'mall_garden_finance', true,
    'reports_view_sales', true, 'reports_view_financials', true
  )
  WHEN role = 'manager' THEN jsonb_build_object(
    'orders', true, 'pos', true, 'captain', true, 'kitchen', true, 'delivery', true,
    'inventory', true, 'hr', true, 'purchasing', true, 'production', true,
    'treasury', false, 'accounting', true, 'journal_approval', false,
    'expense_approval', true, 'revenue_approval', true, 'reports', true,
    'cost_centers', true, 'branch_mgmt', false, 'audit_logs', false, 'users_roles', false,
    'system_manage_users', false, 'system_backup_update', false,
    'maintenance_view', true, 'maintenance_manage_requests', true, 'mall_manage_shops', true,
    'reports_view_sales', true, 'reports_view_financials', true
  )
  WHEN role = 'cashier' THEN jsonb_build_object(
    'orders', true, 'pos', true, 'captain', true, 'kitchen', true, 'delivery', true,
    'inventory', false, 'hr', false, 'purchasing', false, 'production', false,
    'treasury', false, 'accounting', false, 'expense_approval', false,
    'revenue_approval', false, 'reports', false, 'users_roles', false,
    'system_manage_users', false, 'system_backup_update', false
  )
  WHEN role = 'captain' THEN jsonb_build_object(
    'orders', true, 'pos', false, 'captain', true, 'kitchen', false, 'delivery', false,
    'inventory', false, 'hr', false, 'accounting', false, 'reports', false, 'users_roles', false
  )
  WHEN role = 'kitchen' THEN jsonb_build_object(
    'orders', false, 'pos', false, 'captain', false, 'kitchen', true, 'delivery', false,
    'inventory', false, 'hr', false, 'accounting', false, 'reports', false, 'users_roles', false
  )
  ELSE '{}'::jsonb
END
WHERE permissions IS NULL OR permissions = '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uidx
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL AND trim(username) <> '';

-- Profiles created by Supabase Auth are visible to the account that owns them.
-- A user role submitted in user_metadata is not trusted; new accounts start as cashier
-- and their approved role and permissions are set by the authenticated users page.
CREATE OR REPLACE FUNCTION public.handle_new_almokhtar_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate_username text;
BEGIN
  candidate_username := lower(trim(coalesce(
    nullif(NEW.raw_user_meta_data ->> 'username', ''),
    split_part(coalesce(NEW.email, ''), '@', 1),
    'user'
  )));

  INSERT INTO public.profiles (id, username, full_name, phone, role, permissions, created_at, updated_at)
  VALUES (
    NEW.id,
    candidate_username,
    nullif(NEW.raw_user_meta_data ->> 'full_name', ''),
    nullif(NEW.raw_user_meta_data ->> 'phone', ''),
    'cashier',
    '{}'::jsonb,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_almokhtar_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_almokhtar_profile
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_almokhtar_profile();

-- Profile permissions, not app_metadata, govern access to the hosted ERP.
CREATE OR REPLACE FUNCTION public.current_user_can_manage_profiles()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'super_admin')
        OR p.permissions ->> 'users_roles' = 'true'
        OR p.permissions ->> 'system_manage_users' = 'true'
      )
  );
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "TEMP_DEV_ALL_profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_self_or_manager" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_manager" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_manager" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_manager" ON public.profiles;

REVOKE ALL ON public.profiles FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

CREATE POLICY "profiles_read_self_or_manager"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.current_user_can_manage_profiles());

CREATE POLICY "profiles_insert_manager"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_manage_profiles());

CREATE POLICY "profiles_update_manager"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.current_user_can_manage_profiles())
  WITH CHECK (public.current_user_can_manage_profiles());

CREATE POLICY "profiles_delete_manager"
  ON public.profiles FOR DELETE TO authenticated
  USING (public.current_user_can_manage_profiles());

-- Permanently remove an account through the Users page. Auth deletion cascades
-- to profiles and their cloud snapshots; never allow a user to delete themselves.
CREATE OR REPLACE FUNCTION public.delete_managed_user(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  deleted_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_manage_profiles() THEN
    RAISE EXCEPTION 'Insufficient permission to manage users';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete the account you are currently using';
  END IF;

  DELETE FROM auth.users
  WHERE id = target_user_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count = 0 THEN
    RAISE EXCEPTION 'User account not found';
  END IF;

  RETURN true;
END;
$;

REVOKE ALL ON FUNCTION public.delete_managed_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_managed_user(uuid) TO authenticated;

