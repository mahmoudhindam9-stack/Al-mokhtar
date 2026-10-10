
-- Menu categories
CREATE TABLE public.menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.menu_categories TO anon, authenticated;
GRANT ALL ON public.menu_categories TO service_role;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read categories" ON public.menu_categories FOR SELECT USING (true);

-- Menu items
CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  price numeric(10,2) NOT NULL,
  category_id uuid NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  image_url text,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.menu_items TO anon, authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read items" ON public.menu_items FOR SELECT USING (true);

-- Orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number serial UNIQUE,
  subtotal numeric(10,2) NOT NULL,
  tax numeric(10,2) NOT NULL,
  total numeric(10,2) NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash','card','wallet')),
  items jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.orders TO anon, authenticated;
GRANT USAGE ON SEQUENCE public.orders_order_number_seq TO anon, authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON SEQUENCE public.orders_order_number_seq TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public create orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "public read orders" ON public.orders FOR SELECT USING (true);

-- Seed categories
INSERT INTO public.menu_categories (id, name_ar, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111101','بيتزا',1),
  ('11111111-1111-1111-1111-111111111102','برجر وساندويتشات',2),
  ('11111111-1111-1111-1111-111111111103','مشويات',3),
  ('11111111-1111-1111-1111-111111111104','سلطات',4),
  ('11111111-1111-1111-1111-111111111105','مقبلات',5),
  ('11111111-1111-1111-1111-111111111106','مشروبات',6),
  ('11111111-1111-1111-1111-111111111107','حلويات',7);

-- Seed items
INSERT INTO public.menu_items (name_ar, price, category_id, image_url) VALUES
  ('بيتزا سوبر سوبريم', 180, '11111111-1111-1111-1111-111111111101','https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500'),
  ('بيتزا مارجريتا', 140, '11111111-1111-1111-1111-111111111101','https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500'),
  ('بيتزا بيبروني', 160, '11111111-1111-1111-1111-111111111101','https://images.unsplash.com/photo-1628840042765-356cda07504e?w=500'),
  ('برجر لحم فاخر', 120, '11111111-1111-1111-1111-111111111102','https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500'),
  ('برجر دجاج مقرمش', 95, '11111111-1111-1111-1111-111111111102','https://images.unsplash.com/photo-1606131731446-5568d87113aa?w=500'),
  ('ساندويتش شاورما', 75, '11111111-1111-1111-1111-111111111102','https://images.unsplash.com/photo-1633321702518-7feccafb94d5?w=500'),
  ('مشاوي مشكل', 250, '11111111-1111-1111-1111-111111111103','https://images.unsplash.com/photo-1544025162-d76694265947?w=500'),
  ('كباب لحم', 220, '11111111-1111-1111-1111-111111111103','https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500'),
  ('فراخ مشوية', 180, '11111111-1111-1111-1111-111111111103','https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=500'),
  ('سلطة سيزر بالدجاج', 85, '11111111-1111-1111-1111-111111111104','https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=500'),
  ('سلطة يونانية', 70, '11111111-1111-1111-1111-111111111104','https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500'),
  ('حمص بالطحينة', 45, '11111111-1111-1111-1111-111111111105','https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500'),
  ('بابا غنوج', 45, '11111111-1111-1111-1111-111111111105','https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500'),
  ('بطاطس مقلية', 35, '11111111-1111-1111-1111-111111111105','https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500'),
  ('كوكاكولا', 20, '11111111-1111-1111-1111-111111111106','https://images.unsplash.com/photo-1554866585-cd94860890b7?w=500'),
  ('عصير برتقال طازج', 35, '11111111-1111-1111-1111-111111111106','https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500'),
  ('شاي بالنعناع', 15, '11111111-1111-1111-1111-111111111106','https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=500'),
  ('قهوة تركي', 25, '11111111-1111-1111-1111-111111111106','https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500'),
  ('كنافة بالقشطة', 65, '11111111-1111-1111-1111-111111111107','https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=500'),
  ('أم علي', 55, '11111111-1111-1111-1111-111111111107','https://images.unsplash.com/photo-1587314168485-3236d6710814?w=500'),
  ('بسبوسة', 40, '11111111-1111-1111-1111-111111111107','https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=500');
