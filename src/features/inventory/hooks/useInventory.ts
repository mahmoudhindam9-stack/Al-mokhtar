import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  inventoryService,
  UpsertInventoryPayload,
  CreateTransactionPayload,
} from "../services/inventoryService";
import { InventoryItem, InventoryTransaction } from "@/shared/types";

export function useInventory() {
  return useQuery<InventoryItem[]>({
    queryKey: ["admin", "inventory"],
    queryFn: () => inventoryService.getInventory(),
  });
}

export function useInventoryTransactions() {
  return useQuery<InventoryTransaction[]>({
    queryKey: ["admin", "inventory_transactions"],
    queryFn: () => inventoryService.getTransactions(),
  });
}

export function useUpsertInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, id }: { payload: UpsertInventoryPayload; id?: string }) =>
      inventoryService.upsertInventoryItem(payload, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
    },
  });
}

export function useDeleteInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inventoryService.deleteInventoryItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
    },
  });
}

export function useAddInventoryTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTransactionPayload) => inventoryService.addTransaction(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory_transactions"] });
    },
  });
}
