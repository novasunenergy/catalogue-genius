
-- Convert has_role to SECURITY INVOKER to avoid signed-in users executing a SECURITY DEFINER function.
-- Users can read their own user_roles rows via existing policy, so has_role works for auth.uid() checks.
-- Drop the recursive admin policy on user_roles to prevent infinite recursion under INVOKER.
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Revoke execute on claim_signup_role from signed-in users; it will be invoked via the server (service role).
REVOKE EXECUTE ON FUNCTION public.claim_signup_role(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_signup_role(text) TO service_role;
