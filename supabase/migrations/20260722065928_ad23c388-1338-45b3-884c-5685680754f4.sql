
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salesperson_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  salesperson_name text NOT NULL,
  customer_name text NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_code text NOT NULL,
  product_name text NOT NULL,
  brand text,
  category text,
  size text,
  finish text,
  price numeric NOT NULL DEFAULT 0,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'Nos',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salesperson inserts own orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = salesperson_id AND (public.has_role(auth.uid(), 'salesperson'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));

CREATE POLICY "Salesperson sees own orders"
  ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = salesperson_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage orders"
  ON public.orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_salesperson_idx ON public.orders (salesperson_id);

-- Self-assign role on signup: user calls this right after signUp.
-- Rules: admin only if no admin exists yet; salesperson always allowed on first claim; otherwise 'user'.
CREATE OR REPLACE FUNCTION public.claim_signup_role(_requested text)
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  assigned public.app_role;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uid) THEN
    SELECT role INTO assigned FROM public.user_roles WHERE user_id = uid LIMIT 1;
    RETURN assigned;
  END IF;
  IF _requested = 'admin' AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin'::public.app_role) THEN
    assigned := 'admin'::public.app_role;
  ELSIF _requested = 'salesperson' THEN
    assigned := 'salesperson'::public.app_role;
  ELSE
    assigned := 'user'::public.app_role;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, assigned);
  RETURN assigned;
END $$;

REVOKE ALL ON FUNCTION public.claim_signup_role(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_signup_role(text) TO authenticated;
