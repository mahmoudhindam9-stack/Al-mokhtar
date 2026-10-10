-- 1. Create recipes table
CREATE TABLE IF NOT EXISTS public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recipes_menu_item_id_key UNIQUE (menu_item_id)
);

-- 2. Create recipe_ingredients table
CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  inventory_id uuid NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  quantity numeric(10,3) NOT NULL,
  weight numeric(10,3) NOT NULL,
  unit text NOT NULL DEFAULT 'pcs',
  notes text,
  optional boolean NOT NULL DEFAULT false,
  waste_percent numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recipe_ingredients_recipe_id_inventory_id_key UNIQUE (recipe_id, inventory_id)
);

-- 3. Create indexes for quick lookup
CREATE INDEX IF NOT EXISTS idx_recipes_menu_item_id ON public.recipes(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON public.recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_inventory_id ON public.recipe_ingredients(inventory_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- 5. Revoke anon access and grant authenticated/service_role permissions
REVOKE ALL ON public.recipes FROM anon;
REVOKE ALL ON public.recipe_ingredients FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes TO authenticated;
GRANT ALL ON public.recipes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_ingredients TO authenticated;
GRANT ALL ON public.recipe_ingredients TO service_role;

-- 6. Setup RLS policies
DROP POLICY IF EXISTS "authenticated read recipes" ON public.recipes;
CREATE POLICY "authenticated read recipes" 
  ON public.recipes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "manager admin manage recipes" ON public.recipes;
CREATE POLICY "manager admin manage recipes" 
  ON public.recipes FOR ALL TO authenticated 
  USING (public.is_manager_or_admin()) 
  WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "authenticated read recipe_ingredients" ON public.recipe_ingredients;
CREATE POLICY "authenticated read recipe_ingredients" 
  ON public.recipe_ingredients FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "manager admin manage recipe_ingredients" ON public.recipe_ingredients;
CREATE POLICY "manager admin manage recipe_ingredients" 
  ON public.recipe_ingredients FOR ALL TO authenticated 
  USING (public.is_manager_or_admin()) 
  WITH CHECK (public.is_manager_or_admin());

-- 7. Add tracking columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS inventory_processed_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS inventory_reversed boolean NOT NULL DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS inventory_reversed_at timestamptz;

-- 8. Populate recipes and recipe_ingredients from existing menu_items.ingredients JSONB column
DO $$
DECLARE
  m_item record;
  rec_id uuid;
  ing jsonb;
  inv_id uuid;
  wt numeric;
  u text;
  opt boolean;
  waste numeric;
  nt text;
BEGIN
  FOR m_item IN 
    SELECT id, ingredients 
    FROM public.menu_items 
    WHERE ingredients IS NOT NULL 
      AND jsonb_typeof(ingredients) = 'array' 
      AND jsonb_array_length(ingredients) > 0 
  LOOP
    -- Insert recipe row (one-to-one with menu_item)
    INSERT INTO public.recipes (menu_item_id, notes)
    VALUES (m_item.id, 'تم تحويله تلقائياً من المكونات السابقة في لوحة التحكم')
    ON CONFLICT (menu_item_id) DO UPDATE SET notes = EXCLUDED.notes
    RETURNING id INTO rec_id;

    -- Insert each ingredient
    FOR ing IN SELECT * FROM jsonb_array_elements(m_item.ingredients) LOOP
      inv_id := (ing->>'inventory_id')::uuid;
      wt := COALESCE((ing->>'weight')::numeric, (ing->>'quantity')::numeric, 0);
      u := COALESCE(ing->>'unit', 'pcs');
      opt := COALESCE((ing->>'optional')::boolean, false);
      waste := (ing->>'waste_percent')::numeric;
      nt := ing->>'notes';

      -- Check if reference is valid in target inventory table
      IF EXISTS (SELECT 1 FROM public.inventory WHERE id = inv_id) THEN
        INSERT INTO public.recipe_ingredients (recipe_id, inventory_id, quantity, weight, unit, notes, optional, waste_percent)
        VALUES (rec_id, inv_id, wt, wt, u, nt, opt, waste)
        ON CONFLICT (recipe_id, inventory_id) DO UPDATE SET
          quantity = EXCLUDED.quantity,
          weight = EXCLUDED.weight,
          unit = EXCLUDED.unit,
          notes = EXCLUDED.notes,
          optional = EXCLUDED.optional,
          waste_percent = EXCLUDED.waste_percent;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- 9. Drop/disable the previous order-status trigger
DROP TRIGGER IF EXISTS trg_order_inventory_changes ON public.orders;

-- 10. Drop any old incorrect direct menu_item stock triggers if they exist
DROP TRIGGER IF EXISTS trg_apply_order_stock ON public.orders;
DROP TRIGGER IF EXISTS trg_apply_order_stock ON public.menu_items;

-- 11. Create secure atomic RPC for processing order inventory
CREATE OR REPLACE FUNCTION public.process_order_inventory(
  p_order_id uuid,
  p_allow_negative boolean DEFAULT true
)
RETURNS jsonb
SECURITY DEFINER
AS $$
DECLARE
  v_order record;
  v_order_item jsonb;
  v_recipe_ingredient record;
  v_inv_item record;
  v_required_qty numeric;
  v_converted_qty numeric;
  v_ingredients_checked boolean := true;
  v_shortage_msg text := '';
  v_tx_note text;
BEGIN
  -- Load and lock the order row to prevent concurrent modifications
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  
  -- Verify order exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found', 'error_ar', 'الطلب غير موجود');
  END IF;

  -- Verify inventory has not already been processed
  IF COALESCE(v_order.inventory_deducted, FALSE) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Inventory already processed', 'message_ar', 'تم خصم المخزن مسبقاً');
  END IF;

  -- Check for ingredients stock before deducting
  IF jsonb_typeof(v_order.items) = 'array' THEN
    FOR v_order_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
      -- Resolve recipe for this menu item (check recipes/recipe_ingredients tables)
      FOR v_recipe_ingredient IN 
        SELECT ri.*, r.menu_item_id 
        FROM public.recipe_ingredients ri
        JOIN public.recipes r ON r.id = ri.recipe_id
        WHERE r.menu_item_id = COALESCE((v_order_item->>'menu_item_id')::uuid, (v_order_item->>'id')::uuid)
      LOOP
        -- Load inventory item with lock
        SELECT * INTO v_inv_item FROM public.inventory WHERE id = v_recipe_ingredient.inventory_id FOR UPDATE;
        IF FOUND THEN
          -- Convert recipe ingredient quantity (which is in recipe unit) to inventory item unit
          v_required_qty := v_recipe_ingredient.quantity * COALESCE((v_order_item->>'quantity')::numeric, 1);
          v_converted_qty := public.convert_to_inventory_unit(v_required_qty, v_recipe_ingredient.unit, v_inv_item.unit);
          
          -- If not allowing negative stock, validate stock levels
          IF NOT p_allow_negative AND (v_inv_item.quantity < v_converted_qty) THEN
            v_ingredients_checked := false;
            v_shortage_msg := v_shortage_msg || 
              v_inv_item.name_ar || ': المطلوب ' || 
              v_converted_qty || ' ' || COALESCE(v_inv_item.unit, '') || 
              '، المتاح ' || v_inv_item.quantity || ' ' || COALESCE(v_inv_item.unit, '') || '; ';
          END IF;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  -- If shortage was found and allow_negative is false, fail the operation
  IF NOT v_ingredients_checked THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Insufficient stock', 
      'error_ar', 'عجز في المخزون: ' || v_shortage_msg
    );
  END IF;

  -- Deduct inventory and insert transactions
  IF jsonb_typeof(v_order.items) = 'array' THEN
    FOR v_order_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
      FOR v_recipe_ingredient IN 
        SELECT ri.*, r.menu_item_id 
        FROM public.recipe_ingredients ri
        JOIN public.recipes r ON r.id = ri.recipe_id
        WHERE r.menu_item_id = COALESCE((v_order_item->>'menu_item_id')::uuid, (v_order_item->>'id')::uuid)
      LOOP
        v_required_qty := v_recipe_ingredient.quantity * COALESCE((v_order_item->>'quantity')::numeric, 1);
        
        -- Lock inventory row
        SELECT * INTO v_inv_item FROM public.inventory WHERE id = v_recipe_ingredient.inventory_id FOR UPDATE;
        IF FOUND THEN
          v_converted_qty := public.convert_to_inventory_unit(v_required_qty, v_recipe_ingredient.unit, v_inv_item.unit);
          
          -- Update inventory quantity
          UPDATE public.inventory 
          SET quantity = quantity - v_converted_qty, updated_at = NOW() 
          WHERE id = v_recipe_ingredient.inventory_id;
          
          -- Insert transaction
          v_tx_note := 'خصم تلقائي - طلب تحضير #' || v_order.order_number || ' (' || COALESCE(v_order_item->>'name_ar', 'صنف') || ')';
          INSERT INTO public.inventory_transactions (inventory_id, type, quantity, note, created_at)
          VALUES (v_recipe_ingredient.inventory_id, 'out', v_converted_qty, v_tx_note, NOW());
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  -- Mark order inventory processing as completed
  UPDATE public.orders 
  SET 
    inventory_deducted = TRUE,
    inventory_processed_at = NOW(),
    inventory_reversed = FALSE,
    inventory_reversed_at = NULL,
    status = 'preparing',
    updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'message', 'Inventory processed successfully', 'message_ar', 'تم خصم كميات المخزن بنجاح والبدء بالتحضير');
END;
$$ LANGUAGE plpgsql;

-- 12. Create secure atomic RPC for reversing order inventory
CREATE OR REPLACE FUNCTION public.reverse_order_inventory(
  p_order_id uuid
)
RETURNS jsonb
SECURITY DEFINER
AS $$
DECLARE
  v_order record;
  v_order_item jsonb;
  v_recipe_ingredient record;
  v_inv_item record;
  v_required_qty numeric;
  v_converted_qty numeric;
  v_tx_note text;
BEGIN
  -- Load and lock the order row
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  
  -- Verify order exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found', 'error_ar', 'الطلب غير موجود');
  END IF;

  -- Verify it was deducted and not yet reversed
  IF NOT COALESCE(v_order.inventory_deducted, FALSE) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Inventory was not processed, nothing to reverse', 'message_ar', 'المخزن لم يتم خصمه مسبقاً، لا حاجة للإرجاع');
  END IF;

  IF COALESCE(v_order.inventory_reversed, FALSE) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Inventory already reversed', 'message_ar', 'تم إرجاع كميات المخزن مسبقاً');
  END IF;

  -- Restore the inventory quantities
  IF jsonb_typeof(v_order.items) = 'array' THEN
    FOR v_order_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
      FOR v_recipe_ingredient IN 
        SELECT ri.*, r.menu_item_id 
        FROM public.recipe_ingredients ri
        JOIN public.recipes r ON r.id = ri.recipe_id
        WHERE r.menu_item_id = COALESCE((v_order_item->>'menu_item_id')::uuid, (v_order_item->>'id')::uuid)
      LOOP
        v_required_qty := v_recipe_ingredient.quantity * COALESCE((v_order_item->>'quantity')::numeric, 1);
        
        -- Lock inventory row
        SELECT * INTO v_inv_item FROM public.inventory WHERE id = v_recipe_ingredient.inventory_id FOR UPDATE;
        IF FOUND THEN
          v_converted_qty := public.convert_to_inventory_unit(v_required_qty, v_recipe_ingredient.unit, v_inv_item.unit);
          
          -- Update inventory quantity
          UPDATE public.inventory 
          SET quantity = quantity + v_converted_qty, updated_at = NOW() 
          WHERE id = v_recipe_ingredient.inventory_id;
          
          -- Insert transaction
          v_tx_note := 'إرجاع تلقائي - إلغاء طلب #' || v_order.order_number || ' (' || COALESCE(v_order_item->>'name_ar', 'صنف') || ')';
          INSERT INTO public.inventory_transactions (inventory_id, type, quantity, note, created_at)
          VALUES (v_recipe_ingredient.inventory_id, 'in', v_converted_qty, v_tx_note, NOW());
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  -- Mark the inventory consumption as reversed
  UPDATE public.orders 
  SET 
    inventory_deducted = FALSE,
    inventory_reversed = TRUE,
    inventory_reversed_at = NOW(),
    status = 'cancelled',
    updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'message', 'Inventory reversed successfully', 'message_ar', 'تم إرجاع كميات المخزن بنجاح وإلغاء الطلب');
END;
$$ LANGUAGE plpgsql;

-- 13. Revoke direct execute on RPCs from public / anon and grant to authenticated
REVOKE EXECUTE ON FUNCTION public.process_order_inventory(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reverse_order_inventory(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.process_order_inventory(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_order_inventory(uuid) TO authenticated;
