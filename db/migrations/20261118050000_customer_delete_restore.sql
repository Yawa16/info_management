-- Only the trusted server may invoke this function after checking action rights.
CREATE FUNCTION public.change_customer_status(
  p_actor_id uuid,
  p_cust_no text,
  p_operation text
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
    RAISE EXCEPTION 'Invalid customer action actor.';
  END IF;
  IF p_cust_no IS NULL OR length(btrim(p_cust_no)) = 0 OR length(p_cust_no) > 10
    OR p_operation IS NULL OR p_operation NOT IN ('delete', 'restore') THEN
    RAISE EXCEPTION 'Invalid customer status action.';
  END IF;
  IF p_operation = 'restore' AND actor_role NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Only managers can restore customers.';
  END IF;
  IF p_operation = 'delete' AND actor_role = 'user' AND NOT EXISTS (
    SELECT 1 FROM public.user_rights ur
    JOIN public.rights r ON r.id = ur.right_id
    WHERE ur.user_id = p_actor_id AND r.code = 'CUSTOMER_DELETE'
  ) THEN
    RAISE EXCEPTION 'Customer delete permission required.';
  END IF;

  PERFORM set_config('app.current_user', p_actor_id::text, true);
  UPDATE public.customer
  SET status = CASE WHEN p_operation = 'delete' THEN 'Inactive' ELSE 'Active' END
  WHERE cust_no = p_cust_no
    AND status = CASE WHEN p_operation = 'delete' THEN 'Active' ELSE 'Inactive' END;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found or status already changed.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.change_customer_status(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_customer_status(uuid, text, text) TO service_role;
NOTIFY pgrst, 'reload schema';
