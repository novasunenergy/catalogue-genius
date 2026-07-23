DROP POLICY IF EXISTS "Products public read" ON public.products;

CREATE POLICY "Active products public read"
ON public.products
FOR SELECT
TO anon, authenticated
USING (is_active = true);

CREATE POLICY "Admins read all products"
ON public.products
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));