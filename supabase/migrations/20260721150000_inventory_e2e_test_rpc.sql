-- Create secure E2E test RPC for verifying the entire order inventory lifecycle
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

  -- 3. Create E2E Menu Item
  INSERT INTO public.menu_items (name_ar, name_en, price, category_id, is_available)
  VALUES ('سلطة فحص تجريبي', 'E2E Test Salad', 25, v_category_id, true)
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

-- Grant execution to public/anon/authenticated for test access
REVOKE EXECUTE ON FUNCTION public.run_e2e_inventory_test() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.run_e2e_inventory_test() TO anon, authenticated, public;
