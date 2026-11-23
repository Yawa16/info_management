-- Product is soft-deleted; its price history remains attached and unchanged.
-- Active sales details still prevent deletion, matching the Customer safeguard.
CREATE OR REPLACE FUNCTION public.product_check_active_children()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  active_children bigint;
BEGIN
  IF NEW.is_deleted AND NOT OLD.is_deleted THEN
    SELECT count(*) INTO active_children
    FROM public.salesdetail
    WHERE prodcode = OLD.prod_code AND NOT is_deleted;
    IF active_children > 0 THEN
      RAISE EXCEPTION 'Cannot delete product row: % active related record(s) still exist.', active_children;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Only the trusted server may invoke this function after checking action rights.
CREATE FUNCTION public.soft_delete_product(
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
  IF p_prod_code IS NULL OR p_prod_code !~ '^P-[0-9]{1,8}$' THEN
    RAISE EXCEPTION 'Invalid product code.';
  END IF;
  IF actor_role = 'user' AND NOT EXISTS (
    SELECT 1 FROM public.user_rights ur
    JOIN public.rights r ON r.id = ur.right_id
    WHERE ur.user_id = p_actor_id AND r.code = 'PRODUCT_DELETE'
  ) THEN
    RAISE EXCEPTION 'Product delete permission required.';
  END IF;

  PERFORM set_config('app.current_user', p_actor_id::text, true);
  UPDATE public.product
  SET status = 'Inactive'
  WHERE prod_code = p_prod_code
    AND status = 'Active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found or already inactive.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_product(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_product(uuid, text) TO service_role;
NOTIFY pgrst, 'reload schema';
