-- 1. Add inventory_tracking column to menu_items
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS inventory_tracking text NOT NULL DEFAULT 'not_tracked';

-- 2. Update existing menu_items that already have recipes to 'recipe_required' so they don't break
UPDATE public.menu_items mi
SET inventory_tracking = 'recipe_required'
WHERE EXISTS (
  SELECT 1 FROM public.recipes r WHERE r.menu_item_id = mi.id
);

-- 3. Create start_order_preparing function
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
  -- Load and lock the order row to prevent concurrent modifications
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  
  -- Verify order exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found', 'error_ar', 'الطلب غير موجود');
  END IF;

  -- Idempotency check: If inventory is already deducted and status is preparing, return success
  IF COALESCE(v_order.inventory_deducted, FALSE) AND v_order.status = 'preparing' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Order already in preparing state with inventory deducted', 'message_ar', 'الطلب قيد التحضير وتم خصم مكوناته مسبقاً');
  END IF;

  -- Verify current status is pending
  IF v_order.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order must be in pending status to start preparing', 'error_ar', 'يجب أن يكون الطلب في حالة الانتظار لبدء التحضير');
  END IF;

  -- Validate inventory tracking mode and recipe existence
  IF jsonb_typeof(v_order.items) = 'array' THEN
    FOR v_order_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
      v_item_id := COALESCE((v_order_item->>'menu_item_id')::uuid, (v_order_item->>'id')::uuid);
      
      -- Load menu item details
      SELECT name_ar, COALESCE(inventory_tracking, 'not_tracked') INTO v_menu_item_name, v_tracking_mode 
      FROM public.menu_items 
      WHERE id = v_item_id;
      
      IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Menu item not found: ' || v_item_id, 'error_ar', 'صنف المنيو غير موجود');
      END IF;
      
      -- If tracking is recipe_required, verify a recipe exists and has ingredients
      IF v_tracking_mode = 'recipe_required' THEN
        -- Check if recipe exists
        SELECT id INTO v_recipe_id FROM public.recipes WHERE menu_item_id = v_item_id;
        IF NOT FOUND THEN
          RETURN jsonb_build_object(
            'success', false,
            'error', 'Recipe required but not found for item: ' || v_menu_item_name,
            'error_ar', 'الصنف "' || v_menu_item_name || '" يتطلب وصفة لتتبع المخزون، ولكن لم يتم تحديد وصفة له بعد.'
          );
        END IF;
        
        -- Check if recipe actually has ingredients
        IF NOT EXISTS (SELECT 1 FROM public.recipe_ingredients WHERE recipe_id = v_recipe_id) THEN
          RETURN jsonb_build_object(
            'success', false,
            'error', 'Recipe has no ingredients for item: ' || v_menu_item_name,
            'error_ar', 'وصفة الصنف "' || v_menu_item_name || '" لا تحتوي على أي مكونات.'
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Validate stock levels for recipe ingredients (Only for items with recipe_required mode)
  IF jsonb_typeof(v_order.items) = 'array' THEN
    FOR v_order_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
      v_item_id := COALESCE((v_order_item->>'menu_item_id')::uuid, (v_order_item->>'id')::uuid);
      
      -- Get tracking mode
      SELECT COALESCE(inventory_tracking, 'not_tracked') INTO v_tracking_mode 
      FROM public.menu_items 
      WHERE id = v_item_id;
      
      IF v_tracking_mode = 'recipe_required' THEN
        FOR v_recipe_ingredient IN 
          SELECT ri.*, r.menu_item_id 
          FROM public.recipe_ingredients ri
          JOIN public.recipes r ON r.id = ri.recipe_id
          WHERE r.menu_item_id = v_item_id
        LOOP
          -- Load inventory item with lock
          SELECT * INTO v_inv_item FROM public.inventory WHERE id = v_recipe_ingredient.inventory_id FOR UPDATE;
          IF FOUND THEN
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
      END IF;
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
      v_item_id := COALESCE((v_order_item->>'menu_item_id')::uuid, (v_order_item->>'id')::uuid);
      
      -- Get tracking mode
      SELECT COALESCE(inventory_tracking, 'not_tracked') INTO v_tracking_mode 
      FROM public.menu_items 
      WHERE id = v_item_id;
      
      IF v_tracking_mode = 'recipe_required' THEN
        FOR v_recipe_ingredient IN 
          SELECT ri.*, r.menu_item_id 
          FROM public.recipe_ingredients ri
          JOIN public.recipes r ON r.id = ri.recipe_id
          WHERE r.menu_item_id = v_item_id
        LOOP
          v_required_qty := v_recipe_ingredient.quantity * COALESCE((v_order_item->>'quantity')::numeric, 1);
          
          -- Lock inventory row
          SELECT * INTO v_inv_item FROM public.inventory WHERE id = v_recipe_ingredient.inventory_id FOR UPDATE;
          IF FOUND THEN
            v_converted_qty := public.convert_to_inventory_unit(v_required_qty, v_recipe_ingredient.unit, v_inv_item.unit);
            v_has_deductions_to_make := true;
            
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
      END IF;
    END LOOP;
  END IF;

  -- Update order status and set flags
  UPDATE public.orders 
  SET 
    inventory_deducted = v_has_deductions_to_make,
    inventory_processed_at = CASE WHEN v_has_deductions_to_make THEN NOW() ELSE NULL END,
    inventory_reversed = FALSE,
    inventory_reversed_at = NULL,
    status = 'preparing',
    updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'message', 'Order status updated to preparing', 'message_ar', 'تم تحديث حالة الطلب إلى قيد التحضير بنجاح');
END;
$$ LANGUAGE plpgsql;

-- 4. Create cancel_order function
CREATE OR REPLACE FUNCTION public.cancel_order(
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
  v_item_id uuid;
  v_has_reversed_any boolean := false;
BEGIN
  -- Load and lock the order row
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  
  -- Verify order exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found', 'error_ar', 'الطلب غير موجود');
  END IF;

  -- Idempotency check: If already cancelled, return success
  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Order already cancelled', 'message_ar', 'الطلب ملغي بالفعل');
  END IF;

  -- Verify current status allows cancellation (only pending, preparing, ready can be cancelled)
  IF v_order.status NOT IN ('pending', 'preparing', 'ready') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order status does not allow cancellation: ' || v_order.status,
      'error_ar', 'حالة الطلب الحالية لا تسمح بالإلغاء: ' || v_order.status
    );
  END IF;

  -- Restore the inventory quantities if they were deducted
  IF COALESCE(v_order.inventory_deducted, FALSE) THEN
    IF jsonb_typeof(v_order.items) = 'array' THEN
      FOR v_order_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
        v_item_id := COALESCE((v_order_item->>'menu_item_id')::uuid, (v_order_item->>'id')::uuid);
        
        FOR v_recipe_ingredient IN 
          SELECT ri.*, r.menu_item_id 
          FROM public.recipe_ingredients ri
          JOIN public.recipes r ON r.id = ri.recipe_id
          WHERE r.menu_item_id = v_item_id
        LOOP
          v_required_qty := v_recipe_ingredient.quantity * COALESCE((v_order_item->>'quantity')::numeric, 1);
          
          -- Lock inventory row
          SELECT * INTO v_inv_item FROM public.inventory WHERE id = v_recipe_ingredient.inventory_id FOR UPDATE;
          IF FOUND THEN
            v_converted_qty := public.convert_to_inventory_unit(v_required_qty, v_recipe_ingredient.unit, v_inv_item.unit);
            v_has_reversed_any := true;
            
            -- Update inventory quantity
            UPDATE public.inventory 
            SET quantity = quantity + v_converted_qty, updated_at = NOW() 
            WHERE id = v_recipe_ingredient.inventory_id;
            
            -- Insert transaction with ORDER_RETURN inside note, type 'in'
            v_tx_note := 'ORDER_RETURN - إرجاع تلقائي - إلغاء طلب #' || v_order.order_number || ' (' || COALESCE(v_order_item->>'name_ar', 'صنف') || ')';
            INSERT INTO public.inventory_transactions (inventory_id, type, quantity, note, created_at)
            VALUES (v_recipe_ingredient.inventory_id, 'in', v_converted_qty, v_tx_note, NOW());
          END IF;
        END LOOP;
      END LOOP;
    END IF;
  END IF;

  -- Mark the inventory consumption as reversed and status as cancelled
  UPDATE public.orders 
  SET 
    inventory_deducted = FALSE,
    inventory_reversed = CASE WHEN v_has_reversed_any THEN TRUE ELSE v_order.inventory_reversed END,
    inventory_reversed_at = CASE WHEN v_has_reversed_any THEN NOW() ELSE v_order.inventory_reversed_at END,
    status = 'cancelled',
    updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'message', 'Order cancelled and inventory restored', 'message_ar', 'تم إلغاء الطلب وإرجاع كميات المخزن بنجاح');
END;
$$ LANGUAGE plpgsql;

-- 5. Redefine old functions to point directly to our atomic start_order_preparing / cancel_order
CREATE OR REPLACE FUNCTION public.process_order_inventory(
  p_order_id uuid,
  p_allow_negative boolean DEFAULT true
)
RETURNS jsonb
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.start_order_preparing(p_order_id, p_allow_negative);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.reverse_order_inventory(
  p_order_id uuid
)
RETURNS jsonb
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.cancel_order(p_order_id);
END;
$$ LANGUAGE plpgsql;

-- 6. Revoke/Grant Executions
REVOKE EXECUTE ON FUNCTION public.start_order_preparing(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cancel_order(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.start_order_preparing(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.process_order_inventory(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reverse_order_inventory(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.process_order_inventory(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_order_inventory(uuid) TO authenticated;

-- 7. Redefine the E2E verification test function to explicitly make the test item 'recipe_required'
CREATE OR REPLACE FUNCTION public.run_e2e_inventory_test()
RETURNS jsonb
SECURITY DEFINER
AS $$
DECLARE
  v_category_id uuid;
  v_inventory_id uuid;
  v_menu_item_id uuid;
  v_recipe_id uuid;
  v_order_id uuid;
  
  v_qty_initial numeric;
  v_qty_after_pending numeric;
  v_qty_after_preparing numeric;
  v_qty_after_double_preparing numeric;
  v_qty_after_cancelled numeric;
  v_qty_after_double_cancelled numeric;
  
  v_rpc_res1 jsonb;
  v_rpc_res2 jsonb;
  v_rpc_res3 jsonb;
  v_rpc_res4 jsonb;
  
  v_log jsonb := jsonb_build_array();
BEGIN
  -- 1. Create E2E Category
  INSERT INTO public.categories (name_ar, name_en)
  VALUES ('قسم الفحص التجريبي', 'E2E Test Category')
  RETURNING id INTO v_category_id;
  v_log := v_log || jsonb_build_object('step', '1. Category Created', 'id', v_category_id);

  -- 2. Create E2E Inventory Item (100 kg)
  INSERT INTO public.inventory (name_ar, name_en, quantity, min_quantity, unit, cost)
  VALUES ('طماطم فحص تجريبي', 'E2E Test Tomato', 100, 10, 'kg', 5.5)
  RETURNING id, quantity INTO v_inventory_id, v_qty_initial;
  v_log := v_log || jsonb_build_object('step', '2. Inventory Item Created', 'id', v_inventory_id, 'initial_quantity', v_qty_initial);

  -- 3. Create E2E Menu Item (specifically recipe_required)
  INSERT INTO public.menu_items (name_ar, name_en, price, category_id, is_available, inventory_tracking)
  VALUES ('سلطة فحص تجريبي', 'E2E Test Salad', 25, v_category_id, true, 'recipe_required')
  RETURNING id INTO v_menu_item_id;
  v_log := v_log || jsonb_build_object('step', '3. Menu Item Created', 'id', v_menu_item_id);

  -- 4. Create Recipe
  INSERT INTO public.recipes (menu_item_id, notes)
  VALUES (v_menu_item_id, 'وصفة فحص تجريبي')
  RETURNING id INTO v_recipe_id;
  
  -- 5. Create Recipe Ingredient (5 kg per salad)
  INSERT INTO public.recipe_ingredients (recipe_id, inventory_id, quantity, weight, unit, optional)
  VALUES (v_recipe_id, v_inventory_id, 5, 5, 'kg', false);
  v_log := v_log || jsonb_build_object('step', '4. Recipe Created', 'recipe_id', v_recipe_id, 'ingredient_kg_per_item', 5);

  -- 6. Create Pending Order (2 Salads, requiring 2 * 5 = 10 kg)
  INSERT INTO public.orders (order_number, status, order_type, items)
  VALUES (9999, 'pending', 'dine_in', jsonb_build_array(
    jsonb_build_object(
      'id', v_menu_item_id,
      'menu_item_id', v_menu_item_id,
      'name_ar', 'سلطة فحص تجريبي',
      'price', 25,
      'quantity', 2
    )
  ))
  RETURNING id INTO v_order_id;
  v_log := v_log || jsonb_build_object('step', '5. Pending Order Created', 'order_id', v_order_id, 'quantity', 2);

  -- 7. Verify stock does not change when order is pending
  SELECT quantity INTO v_qty_after_pending FROM public.inventory WHERE id = v_inventory_id;
  v_log := v_log || jsonb_build_object('step', '6. Verified Stock Unchanged (Pending)', 'quantity', v_qty_after_pending);

  -- 8. Change pending -> preparing (invokes process_order_inventory)
  v_rpc_res1 := public.process_order_inventory(v_order_id, false);
  SELECT quantity INTO v_qty_after_preparing FROM public.inventory WHERE id = v_inventory_id;
  v_log := v_log || jsonb_build_object('step', '7. Processed Inventory (Preparing)', 'rpc_result', v_rpc_res1, 'new_quantity', v_qty_after_preparing);

  -- 9. Repeat process_order_inventory to verify idempotency
  v_rpc_res2 := public.process_order_inventory(v_order_id, false);
  SELECT quantity INTO v_qty_after_double_preparing FROM public.inventory WHERE id = v_inventory_id;
  v_log := v_log || jsonb_build_object('step', '8. Processed Inventory Again (Idempotency)', 'rpc_result', v_rpc_res2, 'quantity', v_qty_after_double_preparing);

  -- 10. Cancel the order (invokes reverse_order_inventory)
  v_rpc_res3 := public.reverse_order_inventory(v_order_id);
  SELECT quantity INTO v_qty_after_cancelled FROM public.inventory WHERE id = v_inventory_id;
  v_log := v_log || jsonb_build_object('step', '9. Reversed Inventory (Cancelled)', 'rpc_result', v_rpc_res3, 'restored_quantity', v_qty_after_cancelled);

  -- 11. Repeat cancel to verify idempotency
  v_rpc_res4 := public.reverse_order_inventory(v_order_id);
  SELECT quantity INTO v_qty_after_double_cancelled FROM public.inventory WHERE id = v_inventory_id;
  v_log := v_log || jsonb_build_object('step', '10. Reversed Inventory Again (Idempotency)', 'rpc_result', v_rpc_res4, 'quantity', v_qty_after_double_cancelled);

  -- 12. Clean up everything!
  DELETE FROM public.orders WHERE id = v_order_id;
  DELETE FROM public.menu_items WHERE id = v_menu_item_id;
  DELETE FROM public.inventory WHERE id = v_inventory_id;
  DELETE FROM public.categories WHERE id = v_category_id;
  v_log := v_log || jsonb_build_object('step', '11. Cleanup Complete');

  RETURN jsonb_build_object(
    'success', true,
    'initial_stock', v_qty_initial,
    'stock_after_pending', v_qty_after_pending,
    'stock_after_preparing', v_qty_after_preparing,
    'stock_after_double_preparing', v_qty_after_double_preparing,
    'stock_after_cancelled', v_qty_after_cancelled,
    'stock_after_double_cancelled', v_qty_after_double_cancelled,
    'steps_log', v_log
  );
EXCEPTION WHEN OTHERS THEN
  -- Make sure to clean up if possible
  BEGIN
    DELETE FROM public.orders WHERE id = v_order_id;
    DELETE FROM public.menu_items WHERE id = v_menu_item_id;
    DELETE FROM public.inventory WHERE id = v_inventory_id;
    DELETE FROM public.categories WHERE id = v_category_id;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore nested exception during rescue cleanup
  END;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.run_e2e_inventory_test() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.run_e2e_inventory_test() TO anon, authenticated, public;
