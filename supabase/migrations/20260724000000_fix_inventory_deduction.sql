-- Fix inventory deduction by recreating the tables and functions and granting anon permissions

CREATE TABLE IF NOT EXISTS public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recipes_menu_item_id_key UNIQUE (menu_item_id)
);

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

CREATE INDEX IF NOT EXISTS idx_recipes_menu_item_id_fix ON public.recipes(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id_fix ON public.recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_inventory_id_fix ON public.recipe_ingredients(inventory_id);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "TEMP_DEV_ALL_recipes" ON public.recipes;
CREATE POLICY "TEMP_DEV_ALL_recipes" ON public.recipes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "TEMP_DEV_ALL_recipe_ingredients" ON public.recipe_ingredients;
CREATE POLICY "TEMP_DEV_ALL_recipe_ingredients" ON public.recipe_ingredients FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.recipes TO anon, authenticated, service_role;
GRANT ALL ON public.recipe_ingredients TO anon, authenticated, service_role;

-- Add tracking mode
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS inventory_tracking text NOT NULL DEFAULT 'not_tracked';
UPDATE public.menu_items mi SET inventory_tracking = 'recipe_required' WHERE EXISTS (SELECT 1 FROM public.recipes r WHERE r.menu_item_id = mi.id) AND inventory_tracking = 'not_tracked';

-- Function: start_order_preparing
CREATE OR REPLACE FUNCTION public.start_order_preparing(
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
  v_item_id uuid;
  v_menu_item_name text;
  v_tracking_mode text;
  v_recipe_id uuid;
  v_has_deductions_to_make boolean := false;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found', 'error_ar', 'الطلب غير موجود');
  END IF;

  IF v_order.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order is not in pending state', 'error_ar', 'الطلب ليس في حالة قيد الانتظار');
  END IF;

  -- Preliminary check to gather shortfalls and ensure recipes exist for tracked items
  FOR v_order_item IN SELECT * FROM jsonb_array_elements(v_order.items)
  LOOP
    v_item_id := COALESCE((v_order_item->>'menu_item_id')::uuid, (v_order_item->>'id')::uuid);
    v_menu_item_name := COALESCE(v_order_item->>'name_ar', v_order_item->>'name_en', 'Unknown');
    
    SELECT inventory_tracking INTO v_tracking_mode FROM public.menu_items WHERE id = v_item_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    IF v_tracking_mode IN ('recipe_required', 'tracked') THEN
      v_has_deductions_to_make := true;
      SELECT id INTO v_recipe_id FROM public.recipes WHERE menu_item_id = v_item_id LIMIT 1;
      
      IF v_recipe_id IS NULL THEN
        IF v_tracking_mode = 'recipe_required' THEN
          RETURN jsonb_build_object('success', false, 'error', 'Missing recipe for item: ' || v_menu_item_name, 'error_ar', 'وصفة مفقودة للعنصر: ' || v_menu_item_name);
        ELSE
          CONTINUE; -- 'tracked' without recipe might mean it's just tracked but currently has no recipe? But standard says it needs one. We'll skip if no recipe unless it's required.
        END IF;
      END IF;

      FOR v_recipe_ingredient IN 
        SELECT * FROM public.recipe_ingredients WHERE recipe_id = v_recipe_id
      LOOP
        v_required_qty := v_recipe_ingredient.weight * COALESCE((v_order_item->>'quantity')::numeric, 1);
        SELECT * INTO v_inv_item FROM public.inventory WHERE id = v_recipe_ingredient.inventory_id;
        
        IF NOT FOUND THEN
          RETURN jsonb_build_object('success', false, 'error', 'Inventory item missing', 'error_ar', 'عنصر المخزون مفقود للوصفة');
        END IF;

        IF NOT p_allow_negative AND (v_inv_item.quantity < v_required_qty) AND (v_recipe_ingredient.optional = false) THEN
          v_ingredients_checked := false;
          v_shortage_msg := v_shortage_msg || v_inv_item.name_ar || ' (Needs ' || v_required_qty || ', has ' || v_inv_item.quantity || '), ';
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  IF NOT v_ingredients_checked THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient stock: ' || v_shortage_msg, 'error_ar', 'الكمية غير كافية: ' || v_shortage_msg);
  END IF;

  -- Perform deductions
  FOR v_order_item IN SELECT * FROM jsonb_array_elements(v_order.items)
  LOOP
    v_item_id := COALESCE((v_order_item->>'menu_item_id')::uuid, (v_order_item->>'id')::uuid);
    v_menu_item_name := COALESCE(v_order_item->>'name_ar', v_order_item->>'name_en', 'Unknown');
    
    SELECT inventory_tracking INTO v_tracking_mode FROM public.menu_items WHERE id = v_item_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    IF v_tracking_mode IN ('recipe_required', 'tracked') THEN
      SELECT id INTO v_recipe_id FROM public.recipes WHERE menu_item_id = v_item_id LIMIT 1;
      IF v_recipe_id IS NULL THEN CONTINUE; END IF;

      FOR v_recipe_ingredient IN 
        SELECT * FROM public.recipe_ingredients WHERE recipe_id = v_recipe_id
      LOOP
        v_required_qty := v_recipe_ingredient.weight * COALESCE((v_order_item->>'quantity')::numeric, 1);
        
        UPDATE public.inventory 
        SET quantity = quantity - v_required_qty,
            updated_at = now()
        WHERE id = v_recipe_ingredient.inventory_id;
        
        v_tx_note := 'خصم تلقائي - طلب #' || v_order.order_number::text || ' (' || v_menu_item_name || ')';
        
        INSERT INTO public.inventory_transactions (
          inventory_id, type, quantity, note, order_id, created_at
        ) VALUES (
          v_recipe_ingredient.inventory_id, 'out', v_required_qty, v_tx_note, p_order_id, now()
        );
      END LOOP;
    END IF;
  END LOOP;

  UPDATE public.orders SET status = 'preparing' WHERE id = p_order_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- Function: cancel_order
CREATE OR REPLACE FUNCTION public.cancel_order(
  p_order_id uuid
)
RETURNS jsonb
SECURITY DEFINER
AS $$
DECLARE
  v_order record;
  v_tx record;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order is already cancelled');
  END IF;

  -- Revert all 'out' transactions linked to this order
  FOR v_tx IN 
    SELECT * FROM public.inventory_transactions 
    WHERE order_id = p_order_id AND type = 'out'
  LOOP
    -- Restore inventory
    UPDATE public.inventory 
    SET quantity = quantity + v_tx.quantity,
        updated_at = now()
    WHERE id = v_tx.inventory_id;
    
    -- Insert a return transaction
    INSERT INTO public.inventory_transactions (
      inventory_id, type, quantity, note, order_id, created_at
    ) VALUES (
      v_tx.inventory_id, 'in', v_tx.quantity, 'استرجاع كمية لطلب ملغى #' || v_order.order_number::text, p_order_id, now()
    );
  END LOOP;
  
  UPDATE public.orders SET status = 'cancelled' WHERE id = p_order_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.start_order_preparing(uuid, boolean) TO anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid) TO anon, authenticated, public;
