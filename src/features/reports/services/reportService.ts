import { supabase } from "@/integrations/supabase/client";
import { Order, InventoryItem } from "@/shared/types";

export const reportService = {
  async getReportOrders(from?: string, to?: string): Promise<Order[]> {
    let q = supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (from) {
      q = q.gte("created_at", new Date(from).toISOString());
    }
    if (to) {
      q = q.lte("created_at", new Date(to + "T23:59:59").toISOString());
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as Order[];
  },

  async getReportInventory(): Promise<InventoryItem[]> {
    const { data, error } = await supabase.from("inventory").select("*");
    if (error) throw error;
    return (data ?? []) as unknown as InventoryItem[];
  },
};
