-- 1. Add inventory_deducted to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS inventory_deducted boolean NOT NULL DEFAULT FALSE;

-- 2. Helper functions for unit normalization and conversion
CREATE OR REPLACE FUNCTION public.normalize_unit(unit_str text) RETURNS text AS $$
DECLARE
  u text := lower(trim(coalesce(unit_str, '')));
BEGIN
  IF u IN ('kg', 'kilogram', 'كجم', 'كيلوجرام', 'كيلو') THEN RETURN 'kg'; END IF;
  IF u IN ('g', 'gram', 'جم', 'جرام') THEN RETURN 'g'; END IF;
  IF u IN ('l', 'liter', 'لتر', 'ل') THEN RETURN 'l'; END IF;
  IF u IN ('ml', 'milliliter', 'مل', 'مليلتر') THEN RETURN 'ml'; END IF;
  IF u IN ('pcs', 'piece', 'قطعة', 'حبة') THEN RETURN 'pcs'; END IF;
  IF u IN ('box', 'علبة', 'صندوق') THEN RETURN 'box'; END IF;
  IF u IN ('pack', 'كيس', 'عبوة') THEN RETURN 'pack'; END IF;
  IF u IN ('bottle', 'زجاجة') THEN RETURN 'bottle'; END IF;
  IF u IN ('can', 'كان') THEN RETURN 'can'; END IF;
  RETURN u;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.convert_to_inventory_unit(qty numeric, from_unit text, to_unit text) RETURNS numeric AS $$
DECLARE
  norm_from text := public.normalize_unit(from_unit);
  norm_to text := public.normalize_unit(to_unit);
BEGIN
  IF norm_from = norm_to OR norm_from IS NULL OR norm_to IS NULL OR norm_from = '' OR norm_to = '' THEN
    RETURN qty;
  END IF;

  -- Weight conversions
  IF norm_to = 'kg' AND norm_from = 'g' THEN
    RETURN qty / 1000.0;
  END IF;
  IF norm_to = 'g' AND norm_from = 'kg' THEN
    RETURN qty * 1000.0;
  END IF;

  -- Volume conversions
  IF norm_to = 'l' AND norm_from = 'ml' THEN
    RETURN qty / 1000.0;
  END IF;
  IF norm_to = 'ml' AND norm_from = 'l' THEN
    RETURN qty * 1000.0;
  END IF;

  RETURN qty;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Trigger function to handle order status changes, deletion, and order edits
CREATE OR REPLACE FUNCTION public.handle_order_inventory_changes() RETURNS trigger AS $$
DECLARE
  order_item jsonb;
  recipe_item jsonb;
  menu_item_ingredients jsonb;
  inv_item record;
  deduct_qty numeric;
  restore_qty numeric;
  
  -- Action triggers
  is_deduct_action boolean := FALSE;
  is_restore_action boolean := FALSE;
  is_edit_action boolean := FALSE;
  
  current_notes text;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Case 1: Status changed to served, and was not already deducted
    IF NEW.status = 'served' AND NOT COALESCE(NEW.inventory_deducted, FALSE) THEN
      is_deduct_action := TRUE;
      
    -- Case 2: Status is cancelled, and was already deducted
    ELSIF NEW.status = 'cancelled' AND COALESCE(NEW.inventory_deducted, FALSE) THEN
      is_restore_action := TRUE;
      
    -- Case 3: Status changed from served to something else, and was deducted
    ELSIF OLD.status = 'served' AND NEW.status <> 'served' AND COALESCE(NEW.inventory_deducted, FALSE) THEN
      is_restore_action := TRUE;
      
    -- Case 4: Order items modified while remaining served (Order Edit)
    ELSIF OLD.status = 'served' AND NEW.status = 'served' AND COALESCE(OLD.inventory_deducted, FALSE) AND OLD.items <> NEW.items THEN
      is_edit_action := TRUE;
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Case 5: Deleted order was served and deducted, restore inventory
    IF OLD.status = 'served' AND COALESCE(OLD.inventory_deducted, FALSE) THEN
      is_restore_action := TRUE;
    END IF;
  END IF;

  -- Execute Edit Action (Reverse OLD items first, then Deduct NEW items)
  IF is_edit_action THEN
    -- 1. Reverse OLD items (Restore)
    IF jsonb_typeof(OLD.items) = 'array' THEN
      FOR order_item IN SELECT * FROM jsonb_array_elements(OLD.items) LOOP
        SELECT ingredients INTO menu_item_ingredients FROM public.menu_items WHERE id = (order_item->>'id')::uuid;
        IF menu_item_ingredients IS NOT NULL AND jsonb_typeof(menu_item_ingredients) = 'array' THEN
          FOR recipe_item IN SELECT * FROM jsonb_array_elements(menu_item_ingredients) LOOP
            SELECT * INTO inv_item FROM public.inventory WHERE id = (recipe_item->>'inventory_id')::uuid;
            IF FOUND THEN
              restore_qty := public.convert_to_inventory_unit(
                (recipe_item->>'weight')::numeric,
                recipe_item->>'unit',
                inv_item.unit
              ) * (order_item->>'quantity')::numeric;

              IF restore_qty > 0 THEN
                UPDATE public.inventory SET quantity = quantity + restore_qty, updated_at = NOW() WHERE id = inv_item.id;
                INSERT INTO public.inventory_transactions (inventory_id, type, quantity, note, created_at)
                VALUES (
                  inv_item.id, 'in', restore_qty,
                  'تعديل الطلب (إرجاع الكمية القديمة) #' || NEW.order_number || ' (' || COALESCE(order_item->>'name_ar', 'صنف') || ')',
                  NOW()
                );
              END IF;
            END IF;
          END LOOP;
        END IF;
      END LOOP;
    END IF;

    -- 2. Apply NEW items (Deduct)
    IF jsonb_typeof(NEW.items) = 'array' THEN
      FOR order_item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
        SELECT ingredients INTO menu_item_ingredients FROM public.menu_items WHERE id = (order_item->>'id')::uuid;
        IF menu_item_ingredients IS NOT NULL AND jsonb_typeof(menu_item_ingredients) = 'array' THEN
          FOR recipe_item IN SELECT * FROM jsonb_array_elements(menu_item_ingredients) LOOP
            SELECT * INTO inv_item FROM public.inventory WHERE id = (recipe_item->>'inventory_id')::uuid;
            IF FOUND THEN
              deduct_qty := public.convert_to_inventory_unit(
                (recipe_item->>'weight')::numeric,
                recipe_item->>'unit',
                inv_item.unit
              ) * (order_item->>'quantity')::numeric;

              IF deduct_qty > 0 THEN
                UPDATE public.inventory SET quantity = quantity - deduct_qty, updated_at = NOW() WHERE id = inv_item.id;
                INSERT INTO public.inventory_transactions (inventory_id, type, quantity, note, created_at)
                VALUES (
                  inv_item.id, 'out', deduct_qty,
                  'تعديل الطلب (خصم الكمية الجديدة) #' || NEW.order_number || ' (' || COALESCE(order_item->>'name_ar', 'صنف') || ')',
                  NOW()
                );
              END IF;
            END IF;
          END LOOP;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Execute Standard Deduction
  IF is_deduct_action THEN
    NEW.inventory_deducted := TRUE;
    current_notes := COALESCE(NEW.notes, '');
    IF current_notes NOT LIKE '%[ingredients_deducted]%' THEN
      NEW.notes := TRIM(current_notes || ' [ingredients_deducted]');
    END IF;

    IF jsonb_typeof(NEW.items) = 'array' THEN
      FOR order_item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
        SELECT ingredients INTO menu_item_ingredients FROM public.menu_items WHERE id = (order_item->>'id')::uuid;
        IF menu_item_ingredients IS NOT NULL AND jsonb_typeof(menu_item_ingredients) = 'array' THEN
          FOR recipe_item IN SELECT * FROM jsonb_array_elements(menu_item_ingredients) LOOP
            SELECT * INTO inv_item FROM public.inventory WHERE id = (recipe_item->>'inventory_id')::uuid;
            IF FOUND THEN
              deduct_qty := public.convert_to_inventory_unit(
                (recipe_item->>'weight')::numeric,
                recipe_item->>'unit',
                inv_item.unit
              ) * (order_item->>'quantity')::numeric;

              IF deduct_qty > 0 THEN
                UPDATE public.inventory SET quantity = quantity - deduct_qty, updated_at = NOW() WHERE id = inv_item.id;
                INSERT INTO public.inventory_transactions (inventory_id, type, quantity, note, created_at)
                VALUES (
                  inv_item.id, 'out', deduct_qty,
                  'خصم تلقائي - طلب مكتمل #' || NEW.order_number || ' (' || COALESCE(order_item->>'name_ar', 'صنف') || ')',
                  NOW()
                );
              END IF;
            END IF;
          END LOOP;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Execute Standard Restoration
  IF is_restore_action THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.inventory_deducted := FALSE;
      current_notes := COALESCE(NEW.notes, '');
      IF current_notes LIKE '%[ingredients_deducted]%' THEN
        NEW.notes := TRIM(REPLACE(current_notes, '[ingredients_deducted]', ''));
      END IF;
      IF NEW.notes NOT LIKE '%[ingredients_restored]%' THEN
        NEW.notes := TRIM(NEW.notes || ' [ingredients_restored]');
      END IF;
    END IF;

    DECLARE
      target_items jsonb := CASE WHEN TG_OP = 'DELETE' THEN OLD.items ELSE NEW.items END;
      target_order_number int := CASE WHEN TG_OP = 'DELETE' THEN OLD.order_number ELSE NEW.order_number END;
    BEGIN
      IF jsonb_typeof(target_items) = 'array' THEN
        FOR order_item IN SELECT * FROM jsonb_array_elements(target_items) LOOP
          SELECT ingredients INTO menu_item_ingredients FROM public.menu_items WHERE id = (order_item->>'id')::uuid;
          IF menu_item_ingredients IS NOT NULL AND jsonb_typeof(menu_item_ingredients) = 'array' THEN
            FOR recipe_item IN SELECT * FROM jsonb_array_elements(menu_item_ingredients) LOOP
              SELECT * INTO inv_item FROM public.inventory WHERE id = (recipe_item->>'inventory_id')::uuid;
              IF FOUND THEN
                restore_qty := public.convert_to_inventory_unit(
                  (recipe_item->>'weight')::numeric,
                  recipe_item->>'unit',
                  inv_item.unit
                ) * (order_item->>'quantity')::numeric;

                IF restore_qty > 0 THEN
                  UPDATE public.inventory SET quantity = quantity + restore_qty, updated_at = NOW() WHERE id = inv_item.id;
                  INSERT INTO public.inventory_transactions (inventory_id, type, quantity, note, created_at)
                  VALUES (
                    inv_item.id, 'in', restore_qty,
                    CASE WHEN TG_OP = 'DELETE' THEN 'إرجاع تلقائي - طلب محذوف #' ELSE 'إرجاع تلقائي - طلب ملغى #' END || target_order_number || ' (' || COALESCE(order_item->>'name_ar', 'صنف') || ')',
                    NOW()
                  );
                END IF;
              END IF;
            END LOOP;
          END IF;
        END LOOP;
      END IF;
    END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger
DROP TRIGGER IF EXISTS trg_order_inventory_changes ON public.orders;
CREATE TRIGGER trg_order_inventory_changes
  BEFORE INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_order_inventory_changes();
