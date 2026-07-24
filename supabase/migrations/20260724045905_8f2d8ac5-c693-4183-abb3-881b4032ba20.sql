ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Ordered',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'Pending';

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN ('Ordered','Delivered','Cancelled'));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('Done','Pending','On Credit'));