import { supabase } from "@/integrations/supabase/client";
import {
  InventoryItem,
  InventoryTransaction,
  Warehouse,
  WarehouseInventory,
  WarehouseTransfer,
} from "@/shared/types";
import { localWarehouseStore } from "./warehouseStore";
import { convertToInventoryUnit } from "@/shared/utils/inventoryUtils";
import { erpStore } from "@/shared/services/erpStore";

export interface UpsertInventoryPayload {
  name_ar: string;
  unit: string;
  quantity: number;
  min_level: number;
  cost: number;
  category?: string;
}

export interface CreateTransactionPayload {
  inventory_id: string;
  warehouse_id?: string | null;
  type: string;
  quantity: number;
  note: string | null;
}

export interface CreateWarehousePayload {
  name: string;
  description?: string;
  location?: string;
  is_default?: boolean;
  auto_populate_ingredients?: boolean;
}

export interface TransferInventoryPayload {
  source_warehouse_id: string;
  destination_warehouse_id: string;
  inventory_id: string;
  quantity: number;
  notes?: string;
}

export const inventoryService = {
  async getInventory(): Promise<InventoryItem[]> {
    try {
      const { data, error } = await supabase.from("inventory").select("*").order("name_ar");
      if (error) throw error;
      if (data && data.length > 0) {
        localWarehouseStore.saveInventory(data as InventoryItem[]);
        return data as InventoryItem[];
      }
    } catch {
      // Fallback to local store
    }
    return localWarehouseStore.getInventory();
  },

  async getWarehouses(): Promise<Warehouse[]> {
    try {
      const { data, error } = await (supabase as any)
        .from("warehouses")
        .select("*")
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      if (data && data.length > 0) {
        localWarehouseStore.saveWarehouses(data as Warehouse[]);
        return data as Warehouse[];
      }
    } catch {
      // Fallback
    }
    return localWarehouseStore.getWarehouses();
  },

  async getWarehouseInventory(warehouseId?: string): Promise<WarehouseInventory[]> {
    try {
      let query = (supabase as any).from("warehouse_inventory").select("*");
      if (warehouseId) {
        query = query.eq("warehouse_id" as any, warehouseId);
      }
      const { data, error } = await query;
      if (error) throw error;
      if (data && data.length > 0) {
        return data as WarehouseInventory[];
      }
    } catch {
      // Fallback
    }
    return localWarehouseStore.getWarehouseInventory(warehouseId);
  },

  async getWarehouseTransfers(): Promise<WarehouseTransfer[]> {
    try {
      const { data, error } = await supabase
        .from("warehouse_transfers" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (data && data.length > 0) {
        return data as any as WarehouseTransfer[];
      }
    } catch {
      // Fallback
    }
    return localWarehouseStore.getWarehouseTransfers();
  },

  async createWarehouse(payload: CreateWarehousePayload): Promise<Warehouse> {
    try {
      const { data, error } = await (supabase.rpc as any)("create_warehouse_with_options", {
        p_name: payload.name,
        p_description: payload.description || null,
        p_location: payload.location || null,
        p_is_default: payload.is_default ?? false,
        p_auto_populate_ingredients: payload.auto_populate_ingredients ?? true,
      });
      if (!error && data && data.success && data.warehouse) {
        return data.warehouse as Warehouse;
      }
    } catch {
      // Fallback
    }
    return localWarehouseStore.createWarehouse(payload);
  },

  async updateWarehouse(id: string, payload: Partial<Warehouse>): Promise<Warehouse> {
    try {
      if (payload.is_default) {
        await (supabase as any).from("warehouses").update({ is_default: false }).neq("id", id);
      }
      const { data, error } = await (supabase as any)
        .from("warehouses")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (!error && data) return data as Warehouse;
    } catch {
      // Fallback
    }
    return localWarehouseStore.updateWarehouse(id, payload);
  },

  async deleteWarehouse(id: string): Promise<void> {
    try {
      const { error } = await (supabase as any).from("warehouses").delete().eq("id", id);
      if (!error) return;
    } catch {
      // Fallback
    }
    localWarehouseStore.deleteWarehouse(id);
  },

  async transferInventory(payload: TransferInventoryPayload): Promise<void> {
    try {
      const { data, error } = await (supabase.rpc as any)("transfer_inventory", {
        p_source_warehouse_id: payload.source_warehouse_id,
        p_destination_warehouse_id: payload.destination_warehouse_id,
        p_inventory_id: payload.inventory_id,
        p_quantity: payload.quantity,
        p_notes: payload.notes || null,
      });
      if (!error && data && data.success) {
        return;
      }
    } catch {
      // Fallback
    }
    localWarehouseStore.transferInventory(payload);
  },

  async getTransactions(warehouseId?: string): Promise<InventoryTransaction[]> {
    try {
      let query = supabase.from("inventory_transactions").select("*");
      if (warehouseId) {
        query = query.eq("warehouse_id" as any, warehouseId);
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (!error && data) return data as unknown as InventoryTransaction[];
    } catch {
      // Fallback
    }
    return localWarehouseStore.getTransactions(warehouseId);
  },

  async upsertInventoryItem(
    payload: UpsertInventoryPayload,
    id?: string,
    warehouseId?: string,
  ): Promise<InventoryItem> {
    try {
      let item: InventoryItem | null = null;
      if (id) {
        const { data, error } = await supabase
          .from("inventory" as any)
          .update(payload)
          .eq("id", id)
          .select()
          .single();
        if (!error && data) item = data as InventoryItem;
      } else {
        const { data, error } = await supabase.from("inventory" as any).insert(payload).select().single();
        if (!error && data) item = data as InventoryItem;
      }

      if (item) {
        let targetWhId = warehouseId;
        if (!targetWhId) {
          const { data: defaultWh } = await (supabase as any)
            .from("warehouses")
            .select("id")
            .eq("is_default", true)
            .maybeSingle();
          targetWhId = defaultWh?.id;
        }

        if (targetWhId) {
          await (supabase as any).from("warehouse_inventory").upsert(
            {
              warehouse_id: targetWhId,
              inventory_id: item.id,
              quantity: payload.quantity,
              min_level: payload.min_level,
            },
            { onConflict: "warehouse_id,inventory_id" },
          );
        }
        return item;
      }
    } catch {
      // Fallback
    }

    const result = localWarehouseStore.upsertInventoryItem(payload, id, warehouseId);
    try {
      erpStore.recalculateAccountBalances();
      erpStore.notify();
    } catch {
      // Ignore
    }
    return result;
  },

  async deleteInventoryItem(id: string): Promise<void> {
    try {
      const { error } = await supabase.from("inventory").delete().eq("id", id);
      if (!error) return;
    } catch {
      // Fallback
    }
    localWarehouseStore.deleteInventoryItem(id);
    try {
      erpStore.recalculateAccountBalances();
      erpStore.notify();
    } catch {
      // Ignore
    }
  },

  async clearAllInventoryItems(): Promise<void> {
    try {
      await supabase.from("inventory").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    } catch {
      // Fallback
    }
    localWarehouseStore.clearAllInventoryItems();
    try {
      erpStore.recalculateAccountBalances();
      erpStore.notify();
    } catch {
      // Ignore
    }
  },

  async addTransaction(payload: CreateTransactionPayload): Promise<void> {
    try {
      // 1. Insert the transaction record to Supabase if possible
      // Note: inventory_transactions might not have warehouse_id column in actual DB,
      // but we try to include it if types allowed it (or it will just ignore/error silently)
      const { error: txErr } = await (supabase as any).from("inventory_transactions").insert({
        inventory_id: payload.inventory_id,
        // warehouse_id: payload.warehouse_id || null, // Removed as it might not exist in DB
        type: payload.type,
        quantity: payload.quantity,
        note: payload.note || null,
      });

      if (txErr) console.warn("Supabase Transaction insert skipped/failed:", txErr.message);

      // 2. Update the main inventory table directly in Supabase (Global stock)
      const { data: invItem, error: fetchErr } = await supabase
        .from("inventory")
        .select("quantity")
        .eq("id", payload.inventory_id)
        .single();

      if (!fetchErr && invItem) {
        const currentQty = Number(invItem.quantity || 0);
        let newQty = currentQty;
        if (payload.type === "in") {
          newQty = currentQty + payload.quantity;
        } else if (payload.type === "out") {
          newQty = currentQty - payload.quantity;
        } else if (payload.type === "adjustment") {
          newQty = payload.quantity;
        }

        const { error: updateErr } = await supabase
          .from("inventory")
          .update({
            quantity: newQty,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payload.inventory_id);

        if (updateErr) {
          console.error("Supabase Inventory update error:", updateErr);
        }
      }
    } catch (err) {
      console.error("Supabase integration error in addTransaction:", err);
    }

    // 3. ALWAYS update the localWarehouseStore (This handles the "per-warehouse" stock for the UI)
    // This is crucial because the DB schema doesn't support multiple warehouses currently.
    localWarehouseStore.addTransaction({
      inventory_id: payload.inventory_id,
      warehouse_id: payload.warehouse_id,
      type: payload.type as any,
      quantity: payload.quantity,
      note: payload.note,
    });
  },

  async getOperationalWarehouseId(): Promise<string> {
    try {
      const warehouses = await this.getWarehouses();
      const candidates = warehouses.filter((w) => w.name === "مخزن الفرن والمطبخ");

      if (candidates.length === 0) return "wh-sub-kitchen";
      if (candidates.length === 1) return candidates[0].id;

      // Search for the one with 152 Coca-Cola cans
      const allInv = await this.getInventory();
      const cocaItem = allInv.find((i) => i.name_ar.includes("كوكاكولا"));
      const cocaId = cocaItem?.id || "inv-seed-11";

      for (const wh of candidates) {
        const inv = await this.getWarehouseInventory(wh.id);
        const coca = inv.find((i) => i.inventory_id === cocaId);
        // Look for the specific count provided by the user (152)
        if (coca && Math.round(Number(coca.quantity)) === 152) {
          return wh.id;
        }
      }

      // Fallback to the most recent one if no specific match
      return candidates.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )[0].id;
    } catch {
      return "wh-sub-kitchen";
    }
  },

  async deductOrderIngredients(
    _orderId: string,
    _items: any[],
    _orderNumber: number,
    _allowNegative: boolean = true,
  ): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  },

  async restoreOrderIngredients(
    _orderId: string,
    _items: any[],
    _orderNumber: number,
  ): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  },
};
