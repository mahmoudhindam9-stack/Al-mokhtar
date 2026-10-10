import { useQuery } from "@tanstack/react-query";
import { reportService } from "../services/reportService";
import { Order, InventoryItem } from "@/shared/types";

export function useReportOrders(from?: string, to?: string) {
  return useQuery<Order[]>({
    queryKey: ["admin", "reports", "orders", from, to],
    queryFn: () => reportService.getReportOrders(from, to),
  });
}

export function useReportInventory() {
  return useQuery<InventoryItem[]>({
    queryKey: ["admin", "reports", "inventory"],
    queryFn: () => reportService.getReportInventory(),
  });
}
