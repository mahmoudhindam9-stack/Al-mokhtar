alter table public.orders add column if not exists pricing_currency text;
alter table public.orders add column if not exists payment_currency text;
alter table public.orders add column if not exists payment_exchange_rate numeric;
alter table public.orders add column if not exists payment_amount numeric;
alter table public.orders add column if not exists customer_tracking_token text;
create unique index if not exists orders_customer_tracking_token_idx on public.orders(customer_tracking_token) where customer_tracking_token is not null;
