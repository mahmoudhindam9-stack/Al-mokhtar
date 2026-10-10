-- ==============================================================================
-- MULTI-WAREHOUSE INVENTORY SYSTEM & ATOMIC TRANSACTION ARCHITECTURE
-- ==============================================================================

-- 1. Create warehouses table
CREATE TABLE IF NOT EXISTS public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  location text,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create warehouse_inventory table for warehouse-specific stock levels
CREATE TABLE IF NOT EXISTS public.warehouse_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  inventory_id uuid NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  quantity numeric(10,3) NOT NULL DEFAULT 0,
  min_level numeric(10,3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT warehouse_inventory_wh_inv_key UNIQUE (warehouse_id, inventory_id)
);

-- 3. Create warehouse_transfers table for inter-warehouse transfers
CREATE TABLE IF NOT EXISTS public.warehouse_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number text NOT NULL,
  source_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  destination_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  inventory_id uuid NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  quantity numeric(10,3) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'pcs',
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Extend inventory_transactions and orders tables with warehouse_id
ALTER TABLE public.inventory_transactions 
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_transactions 
  ADD COLUMN IF NOT EXISTS transfer_id uuid REFERENCES public.warehouse_transfers(id) ON DELETE SET NULL;

ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL;

-- 5. Create indexes for quick queries
CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_wh ON public.warehouse_inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_inv ON public.warehouse_inventory(inventory_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_transfers_source ON public.warehouse_transfers(source_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_transfers_dest ON public.warehouse_transfers(destination_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_wh ON public.inventory_transactions(warehouse_id);

-- 6. Initial Data Migration: Ensure a Default Warehouse exists and seed current stock
DO $$
DECLARE
  v_default_wh_id uuid;
  v_inv_record record;
BEGIN
  -- Check if default warehouse exists, otherwise create it
  SELECT id INTO v_default_wh_id FROM public.warehouses WHERE is_default = true LIMIT 1;
  
  IF v_default_wh_id IS NULL THEN
    INSERT INTO public.warehouses (name, description, location, is_active, is_default)
    VALUES ('المخزن الرئيسي', 'المخزن الرئيسي الافتراضي للمطعم', 'الفرع الرئيسي', true, true)
    RETURNING id INTO v_default_wh_id;
  END IF;

  -- Migrate existing stock quantities from public.inventory to warehouse_inventory for the default warehouse
  FOR v_inv_record IN SELECT id, quantity, min_level FROM public.inventory LOOP
    INSERT INTO public.warehouse_inventory (warehouse_id, inventory_id, quantity, min_level)
    VALUES (v_default_wh_id, v_inv_record.id, COALESCE(v_inv_record.quantity, 0), COALESCE(v_inv_record.min_level, 0))
    ON CONFLICT (warehouse_id, inventory_id) 
    DO UPDATE SET 
      quantity = EXCLUDED.quantity,
      min_level = EXCLUDED.min_level;
  END LOOP;

  -- Assign default warehouse_id to existing inventory_transactions & orders
  UPDATE public.inventory_transactions 
  SET warehouse_id = v_default_wh_id 
  WHERE warehouse_id IS NULL;

  UPDATE public.orders 
  SET warehouse_id = v_default_wh_id 
  WHERE warehouse_id IS NULL;
END;
$$;

-- 7. Helper Function: Automatically populate a warehouse with ingredients required by menu items
CREATE OR REPLACE FUNCTION public.populate_warehouse_default_ingredients(p_warehouse_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
  v_inv_record record;
BEGIN
  -- Insert all inventory items referenced in recipes/recipe_ingredients OR general inventory
  FOR v_inv_record IN 
    SELECT DISTINCT i.id, i.min_level 
    FROM public.inventory i
  LOOP
    INSERT INTO public.warehouse_inventory (warehouse_id, inventory_id, quantity, min_level)
    VALUES (p_warehouse_id, v_inv_record.id, 0, COALESCE(v_inv_record.min_level, 0))
    ON CONFLICT (warehouse_id, inventory_id) DO NOTHING;
    
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 8. RPC: Create a new warehouse and optionally auto-populate menu ingredients
CREATE OR REPLACE FUNCTION public.create_warehouse_with_options(
  p_name text,
  p_description text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_is_default boolean DEFAULT false,
  p_auto_populate_ingredients boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wh record;
  v_populated_count integer := 0;
BEGIN
  -- If set as default, unset previous default warehouse
  IF p_is_default THEN
    UPDATE public.warehouses SET is_default = false WHERE is_default = true;
  END IF;

  -- Create warehouse
  INSERT INTO public.warehouses (name, description, location, is_active, is_default)
  VALUES (p_name, p_description, p_location, true, p_is_default)
  RETURNING * INTO v_wh;

  -- Auto populate required menu ingredients if requested
  IF p_auto_populate_ingredients THEN
    v_populated_count := public.populate_warehouse_default_ingredients(v_wh.id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'warehouse', row_to_json(v_wh),
    'populated_ingredients_count', v_populated_count,
    'message_ar', 'تم إنشاء المخزن بنجاح وتجهيز أصناف المكونات المطلوبة للمنيو'
  );
END;
$$;

-- 9. RPC: Atomic Stock Transfer Between Warehouses
CREATE OR REPLACE FUNCTION public.transfer_inventory(
  p_source_warehouse_id uuid,
  p_destination_warehouse_id uuid,
  p_inventory_id uuid,
  p_quantity numeric,
  p_notes text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_source_stock record;
  v_dest_stock record;
  v_inv_item record;
  v_transfer_num text;
  v_transfer_id uuid;
  v_dest_qty_before numeric := 0;
BEGIN
  -- 1. Validation
  IF p_source_warehouse_id = p_destination_warehouse_id THEN
    RETURN jsonb_build_object('success', false, 'error_ar', 'لا يمكن التحويل لنفس المخزن');
  END IF;

  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error_ar', 'الكمية المحولة يجب أن تكون أكبر من صفر');
  END IF;

  -- 2. Lock item
  SELECT * INTO v_inv_item FROM public.inventory WHERE id = p_inventory_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_ar', 'الصنف غير موجود بالمخزن');
  END IF;

  -- 3. Lock source warehouse stock
  SELECT * INTO v_source_stock 
  FROM public.warehouse_inventory 
  WHERE warehouse_id = p_source_warehouse_id AND inventory_id = p_inventory_id 
  FOR UPDATE;

  IF NOT FOUND OR v_source_stock.quantity < p_quantity THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error_ar', 'عجز في المخزون: المتاح في مخزن المصدر ' || COALESCE(v_source_stock.quantity, 0) || ' ' || COALESCE(v_inv_item.unit, '')
    );
  END IF;

  -- 4. Lock or create destination warehouse stock
  SELECT * INTO v_dest_stock 
  FROM public.warehouse_inventory 
  WHERE warehouse_id = p_destination_warehouse_id AND inventory_id = p_inventory_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.warehouse_inventory (warehouse_id, inventory_id, quantity, min_level)
    VALUES (p_destination_warehouse_id, p_inventory_id, 0, v_source_stock.min_level)
    RETURNING * INTO v_dest_stock;
  END IF;

  -- 5. Generate transfer number
  v_transfer_num := 'TRF-' || to_char(now(), 'YYYYMMDD') || '-' || substring(gen_random_uuid()::text from 1 for 6);

  -- 6. Insert transfer record
  INSERT INTO public.warehouse_transfers (
    transfer_number, source_warehouse_id, destination_warehouse_id,
    inventory_id, quantity, unit, status, notes, created_by
  )
  VALUES (
    v_transfer_num, p_source_warehouse_id, p_destination_warehouse_id,
    p_inventory_id, p_quantity, COALESCE(v_inv_item.unit, 'pcs'), 'completed', p_notes, p_user_id
  )
  RETURNING id INTO v_transfer_id;

  -- 7. Deduct from source warehouse
  UPDATE public.warehouse_inventory 
  SET quantity = quantity - p_quantity, updated_at = now() 
  WHERE warehouse_id = p_source_warehouse_id AND inventory_id = p_inventory_id;

  -- 8. Add to destination warehouse
  UPDATE public.warehouse_inventory 
  SET quantity = quantity + p_quantity, updated_at = now() 
  WHERE warehouse_id = p_destination_warehouse_id AND inventory_id = p_inventory_id;

  -- 9. Insert transaction records
  INSERT INTO public.inventory_transactions (
    inventory_id, warehouse_id, transfer_id, type, quantity, note, created_at
  )
  VALUES (
    p_inventory_id, p_source_warehouse_id, v_transfer_id, 'out', p_quantity,
    'تحويل مخزني صادر برقم ' || v_transfer_num || COALESCE(' (' || p_notes || ')', ''), now()
  );

  INSERT INTO public.inventory_transactions (
    inventory_id, warehouse_id, transfer_id, type, quantity, note, created_at
  )
  VALUES (
    p_inventory_id, p_destination_warehouse_id, v_transfer_id, 'in', p_quantity,
    'تحويل مخزني وارد برقم ' || v_transfer_num || COALESCE(' (' || p_notes || ')', ''), now()
  );

  -- 10. Update total inventory summary quantity across all warehouses
  UPDATE public.inventory 
  SET quantity = (
    SELECT COALESCE(SUM(quantity), 0) 
    FROM public.warehouse_inventory 
    WHERE inventory_id = p_inventory_id
  ), updated_at = now()
  WHERE id = p_inventory_id;

  RETURN jsonb_build_object(
    'success', true,
    'transfer_number', v_transfer_num,
    'message_ar', 'تم نقل الكمية بنجاح بين المخزنين'
  );
END;
$$;

-- 10. Updated Atomic Order Inventory Deduction Function supporting specific Warehouse
CREATE OR REPLACE FUNCTION public.process_order_inventory(
  p_order_id uuid,
  p_allow_negative boolean DEFAULT true,
  p_warehouse_id uuid DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
AS $$
DECLARE
  v_order record;
  v_order_item jsonb;
  v_recipe_ingredient record;
  v_inv_item record;
  v_wh_stock record;
  v_required_qty numeric;
  v_converted_qty numeric;
  v_ingredients_checked boolean := true;
  v_shortage_msg text := '';
  v_tx_note text;
  v_target_wh_id uuid;
BEGIN
  -- Load and lock the order row
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found', 'error_ar', 'الطلب غير موجود');
  END IF;

  IF COALESCE(v_order.inventory_deducted, FALSE) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Inventory already processed', 'message_ar', 'تم خصم المخزن مسبقاً');
  END IF;

  -- Determine target warehouse
  v_target_wh_id := COALESCE(p_warehouse_id, v_order.warehouse_id);
  IF v_target_wh_id IS NULL THEN
    SELECT id INTO v_target_wh_id FROM public.warehouses WHERE is_default = true LIMIT 1;
  END IF;

  -- Check stock in target warehouse for all ingredients
  IF jsonb_typeof(v_order.items) = 'array' THEN
    FOR v_order_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
      FOR v_recipe_ingredient IN 
        SELECT ri.*, r.menu_item_id 
        FROM public.recipe_ingredients ri
        JOIN public.recipes r ON r.id = ri.recipe_id
        WHERE r.menu_item_id = COALESCE((v_order_item->>'menu_item_id')::uuid, (v_order_item->>'id')::uuid)
      LOOP
        SELECT * INTO v_inv_item FROM public.inventory WHERE id = v_recipe_ingredient.inventory_id FOR UPDATE;
        IF FOUND THEN
          v_required_qty := v_recipe_ingredient.quantity * COALESCE((v_order_item->>'quantity')::numeric, 1);
          v_converted_qty := public.convert_to_inventory_unit(v_required_qty, v_recipe_ingredient.unit, v_inv_item.unit);
          
          -- Check stock in warehouse_inventory
          SELECT * INTO v_wh_stock 
          FROM public.warehouse_inventory 
          WHERE warehouse_id = v_target_wh_id AND inventory_id = v_recipe_ingredient.inventory_id 
          FOR UPDATE;

          IF NOT p_allow_negative AND (COALESCE(v_wh_stock.quantity, 0) < v_converted_qty) THEN
            v_ingredients_checked := false;
            v_shortage_msg := v_shortage_msg || 
              v_inv_item.name_ar || ': المطلوب ' || 
              v_converted_qty || ' ' || COALESCE(v_inv_item.unit, '') || 
              '، المتاح بالمخزن ' || COALESCE(v_wh_stock.quantity, 0) || ' ' || COALESCE(v_inv_item.unit, '') || '; ';
          END IF;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  IF NOT v_ingredients_checked THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Insufficient stock', 
      'error_ar', 'عجز في مخزون الأصناف: ' || v_shortage_msg
    );
  END IF;

  -- Deduct inventory from warehouse_inventory and update main summary
  IF jsonb_typeof(v_order.items) = 'array' THEN
    FOR v_order_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
      FOR v_recipe_ingredient IN 
        SELECT ri.*, r.menu_item_id 
        FROM public.recipe_ingredients ri
        JOIN public.recipes r ON r.id = ri.recipe_id
        WHERE r.menu_item_id = COALESCE((v_order_item->>'menu_item_id')::uuid, (v_order_item->>'id')::uuid)
      LOOP
        v_required_qty := v_recipe_ingredient.quantity * COALESCE((v_order_item->>'quantity')::numeric, 1);
        
        SELECT * INTO v_inv_item FROM public.inventory WHERE id = v_recipe_ingredient.inventory_id FOR UPDATE;
        IF FOUND THEN
          v_converted_qty := public.convert_to_inventory_unit(v_required_qty, v_recipe_ingredient.unit, v_inv_item.unit);
          
          -- Lock & ensure warehouse_inventory record exists
          INSERT INTO public.warehouse_inventory (warehouse_id, inventory_id, quantity, min_level)
          VALUES (v_target_wh_id, v_recipe_ingredient.inventory_id, 0, COALESCE(v_inv_item.min_level, 0))
          ON CONFLICT (warehouse_id, inventory_id) DO NOTHING;

          -- Deduct from warehouse_inventory
          UPDATE public.warehouse_inventory 
          SET quantity = quantity - v_converted_qty, updated_at = NOW() 
          WHERE warehouse_id = v_target_wh_id AND inventory_id = v_recipe_ingredient.inventory_id;
          
          -- Update total inventory summary quantity
          UPDATE public.inventory 
          SET quantity = (
            SELECT COALESCE(SUM(quantity), 0) 
            FROM public.warehouse_inventory 
            WHERE inventory_id = v_recipe_ingredient.inventory_id
          ), updated_at = NOW()
          WHERE id = v_recipe_ingredient.inventory_id;

          -- Insert transaction
          v_tx_note := 'خصم تلقائي - طلب تحضير #' || v_order.order_number || ' (' || COALESCE(v_order_item->>'name_ar', 'صنف') || ')';
          INSERT INTO public.inventory_transactions (inventory_id, warehouse_id, type, quantity, note, created_at)
          VALUES (v_recipe_ingredient.inventory_id, v_target_wh_id, 'out', v_converted_qty, v_tx_note, NOW());
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  -- Mark order as processed
  UPDATE public.orders 
  SET 
    warehouse_id = v_target_wh_id,
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

-- 11. Updated Atomic Order Inventory Reversal Function
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
  v_target_wh_id uuid;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found', 'error_ar', 'الطلب غير موجود');
  END IF;

  IF NOT COALESCE(v_order.inventory_deducted, FALSE) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Inventory was not processed, nothing to reverse', 'message_ar', 'المخزن لم يتم خصمه مسبقاً، لا حاجة للإرجاع');
  END IF;

  IF COALESCE(v_order.inventory_reversed, FALSE) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Inventory already reversed', 'message_ar', 'تم إرجاع كميات المخزن مسبقاً');
  END IF;

  -- Target warehouse from order or default
  v_target_wh_id := COALESCE(v_order.warehouse_id, (SELECT id FROM public.warehouses WHERE is_default = true LIMIT 1));

  -- Restore quantities to warehouse_inventory and total summary
  IF jsonb_typeof(v_order.items) = 'array' THEN
    FOR v_order_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
      FOR v_recipe_ingredient IN 
        SELECT ri.*, r.menu_item_id 
        FROM public.recipe_ingredients ri
        JOIN public.recipes r ON r.id = ri.recipe_id
        WHERE r.menu_item_id = COALESCE((v_order_item->>'menu_item_id')::uuid, (v_order_item->>'id')::uuid)
      LOOP
        v_required_qty := v_recipe_ingredient.quantity * COALESCE((v_order_item->>'quantity')::numeric, 1);
        
        SELECT * INTO v_inv_item FROM public.inventory WHERE id = v_recipe_ingredient.inventory_id FOR UPDATE;
        IF FOUND THEN
          v_converted_qty := public.convert_to_inventory_unit(v_required_qty, v_recipe_ingredient.unit, v_inv_item.unit);
          
          -- Ensure row exists
          INSERT INTO public.warehouse_inventory (warehouse_id, inventory_id, quantity, min_level)
          VALUES (v_target_wh_id, v_recipe_ingredient.inventory_id, 0, COALESCE(v_inv_item.min_level, 0))
          ON CONFLICT (warehouse_id, inventory_id) DO NOTHING;

          -- Add back to warehouse_inventory
          UPDATE public.warehouse_inventory 
          SET quantity = quantity + v_converted_qty, updated_at = NOW() 
          WHERE warehouse_id = v_target_wh_id AND inventory_id = v_recipe_ingredient.inventory_id;
          
          -- Update total summary quantity
          UPDATE public.inventory 
          SET quantity = (
            SELECT COALESCE(SUM(quantity), 0) 
            FROM public.warehouse_inventory 
            WHERE inventory_id = v_recipe_ingredient.inventory_id
          ), updated_at = NOW()
          WHERE id = v_recipe_ingredient.inventory_id;

          -- Insert transaction
          v_tx_note := 'إرجاع تلقائي - إلغاء طلب #' || v_order.order_number || ' (' || COALESCE(v_order_item->>'name_ar', 'صنف') || ')';
          INSERT INTO public.inventory_transactions (inventory_id, warehouse_id, type, quantity, note, created_at)
          VALUES (v_recipe_ingredient.inventory_id, v_target_wh_id, 'in', v_converted_qty, v_tx_note, NOW());
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  -- Mark order inventory as reversed
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

-- 12. Enable RLS and Grant Permissions for Warehouses
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_transfers ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.warehouses TO anon, authenticated, service_role;
GRANT ALL ON public.warehouse_inventory TO anon, authenticated, service_role;
GRANT ALL ON public.warehouse_transfers TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "TEMP_DEV_ALL_warehouses" ON public.warehouses;
CREATE POLICY "TEMP_DEV_ALL_warehouses" ON public.warehouses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "TEMP_DEV_ALL_warehouse_inventory" ON public.warehouse_inventory;
CREATE POLICY "TEMP_DEV_ALL_warehouse_inventory" ON public.warehouse_inventory FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "TEMP_DEV_ALL_warehouse_transfers" ON public.warehouse_transfers;
CREATE POLICY "TEMP_DEV_ALL_warehouse_transfers" ON public.warehouse_transfers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 13. Grant Execute Permissions on Functions
GRANT EXECUTE ON FUNCTION public.populate_warehouse_default_ingredients(uuid) TO anon, authenticated, public, service_role;
GRANT EXECUTE ON FUNCTION public.create_warehouse_with_options(text, text, text, boolean, boolean) TO anon, authenticated, public, service_role;
GRANT EXECUTE ON FUNCTION public.transfer_inventory(uuid, uuid, uuid, numeric, text, uuid) TO anon, authenticated, public, service_role;
GRANT EXECUTE ON FUNCTION public.process_order_inventory(uuid, boolean, uuid) TO anon, authenticated, public, service_role;
GRANT EXECUTE ON FUNCTION public.reverse_order_inventory(uuid) TO anon, authenticated, public, service_role;
