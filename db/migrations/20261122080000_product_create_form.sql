-- Widen legacy Product text fields and allow the Sprint 2 unit vocabulary.
ALTER TABLE public.product
  ALTER COLUMN description TYPE varchar(200),
  ALTER COLUMN unit TYPE varchar(20);
ALTER TABLE public.product DROP CONSTRAINT IF EXISTS unit_ck;
ALTER TABLE public.product
  ADD CONSTRAINT product_description_required CHECK (btrim(description) <> ''),
  ADD CONSTRAINT product_unit_required CHECK (btrim(unit) <> '');

-- Only the trusted server may invoke this function after checking PRODUCT_ADD.
CREATE FUNCTION public.save_product_form(
  p_actor_id uuid,
  p_description text,
  p_unit text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_role text;
  next_number bigint;
  product_code text;
BEGIN
  SELECT role INTO actor_role
  FROM public.profiles
  WHERE id = p_actor_id
    AND NOT is_blocked
    AND approval_status IN ('active', 'approved');
  IF actor_role IS NULL THEN
    RAISE EXCEPTION 'Invalid product action actor.';
  END IF;

  IF p_description IS NULL OR length(btrim(p_description)) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Invalid product description.';
  END IF;
  IF p_unit IS NULL OR length(btrim(p_unit)) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'Invalid product unit.';
  END IF;

  IF actor_role = 'user' AND NOT EXISTS (
    SELECT 1
    FROM public.user_rights ur
    JOIN public.rights r ON r.id = ur.right_id
    WHERE ur.user_id = p_actor_id
      AND r.code = 'PRODUCT_ADD'
  ) THEN
    RAISE EXCEPTION 'Product add permission required.';
  END IF;

  PERFORM set_config('app.current_user', p_actor_id::text, true);
  PERFORM pg_advisory_xact_lock(684221);
  SELECT coalesce(max(substring(prod_code FROM 3)::bigint), 0) + 1
    INTO next_number
  FROM public.product
  WHERE prod_code ~ '^P-[0-9]{1,8}$';
  IF next_number > 99999999 THEN
    RAISE EXCEPTION 'Product number capacity exhausted.';
  END IF;
  product_code := 'P-' || lpad(next_number::text, greatest(3, length(next_number::text)), '0');

  INSERT INTO public.product (prod_code, description, unit, status)
  VALUES (product_code, btrim(p_description), btrim(p_unit), 'Active');
  RETURN product_code;
END;
$$;

REVOKE ALL ON FUNCTION public.save_product_form(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_product_form(uuid, text, text) TO service_role;
NOTIFY pgrst, 'reload schema';
