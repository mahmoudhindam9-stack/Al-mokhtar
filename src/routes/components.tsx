import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export const Route = createFileRoute("/components")({
  head: () => ({ meta: [{ title: "مكونات الوجبات" }] }),
  component: ComponentsPage,
});

type MenuItem = {
  id: string;
  name_ar: string;
  price: number;
  category_id: string;
  image_url: string | null;
};

type Category = { id: string; name_ar: string };

function ComponentsPage() {
  const itemsQuery = useQuery({
    queryKey: ["menu_items_for_components"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id,name_ar,price,category_id,image_url")
        .eq("is_available", true)
        .order("name_ar");
      if (error) throw error;
      return (data ?? []) as MenuItem[];
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ["menu_categories_for_components"],
    queryFn: async () => {
      const { data, error } = await supabase.from("menu_categories").select("id,name_ar");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const categoriesMap = useMemo(() => {
    const map = new Map<string, string>();
    (categoriesQuery.data ?? []).forEach((c) => map.set(c.id, c.name_ar));
    return map;
  }, [categoriesQuery.data]);

  const items = itemsQuery.data ?? [];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">مكونات الوجبات</h1>
      {itemsQuery.isLoading ? (
        <div>جاري التحميل…</div>
      ) : items.length === 0 ? (
        <div>لا توجد أصناف متاحة</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.map((item) => (
            <div key={item.id} className="bg-card p-3 rounded-xl border border-border">
              <div className="aspect-[4/3] bg-muted rounded-md overflow-hidden mb-3">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name_ar}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    لا توجد صورة
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm">{item.name_ar}</div>
                  <div className="text-xs text-muted-foreground">
                    {categoriesMap.get(item.category_id) ?? "عام"}
                  </div>
                </div>
                <div className="text-sm font-black">{item.price} ج.م</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
