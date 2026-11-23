-- Restore inactive products through a manager-only, server-invoked RPC.
-- Status and audit triggers restore is_deleted and write the RESTORED stamp.
CREATE FUNCTION public.restore_product(
  p_actor_id uuid,
  p_prod_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_role text;
BEGIN
  SELECT role INTO actor_role FROM public.profiles
  WHERE id = p_actor_id AND NOT is_blocked
    AND approval_status IN ('active', 'approved');
  IF actor_role IS NULL OR actor_role NOT IN ('user', 'admin', 'superadmin') THEN
    RAISE EXCEPTION 'Invalid product action actor.';
  END IF;
  IF actor_role NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Only managers can restore products.';
  END IF;
  IF p_prod_code IS NULL OR p_prod_code !~ '^P-[0-9]{1,8}$' THEN
    RAISE EXCEPTION 'Invalid product code.';
  END IF;

  PERFORM set_config('app.current_user', p_actor_id::text, true);
  UPDATE public.product
  SET status = 'Active'
  WHERE prod_code = p_prod_code
    AND status = 'Inactive';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found or already active.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_product(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_product(uuid, text) TO service_role;
NOTIFY pgrst, 'reload schema';
