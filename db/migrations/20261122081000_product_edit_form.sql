-- Separate edit migration for Sprint 2 Task 5 edit PR.
DROP VIEW public.product_active;
ALTER TABLE public.product
  ALTER COLUMN description TYPE varchar(200),
  ALTER COLUMN unit TYPE varchar(20);
ALTER TABLE public.product DROP CONSTRAINT IF EXISTS unit_ck;
ALTER TABLE public.product
  DROP CONSTRAINT IF EXISTS product_description_required,
  DROP CONSTRAINT IF EXISTS product_unit_required;
ALTER TABLE public.product
  ADD CONSTRAINT product_description_required CHECK (description IS NULL OR btrim(description) <> ''),
  ADD CONSTRAINT product_unit_required CHECK (unit IS NULL OR btrim(unit) <> '');

CREATE VIEW public.product_active WITH (security_invoker = true) AS
  SELECT prod_code AS prodcode, description, unit, is_deleted, stamp
  FROM public.product
  WHERE NOT is_deleted;
ALTER VIEW public.product_active OWNER TO postgres;
GRANT ALL ON public.product_active TO anon, authenticated, service_role;

CREATE FUNCTION public.edit_product_form(
  p_actor_id uuid,
  p_prod_code text,
  p_description text,
  p_unit text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_role text;
BEGIN
  SELECT role INTO actor_role
  FROM public.profiles
  WHERE id = p_actor_id
    AND NOT is_blocked
    AND approval_status IN ('active', 'approved');
  IF actor_role IS NULL THEN
    RAISE EXCEPTION 'Invalid product action actor.';
  END IF;
  IF p_prod_code IS NULL OR p_prod_code !~ '^P-[0-9]{1,8}$' THEN
    RAISE EXCEPTION 'Invalid product code.';
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
      AND r.code = 'PRODUCT_EDIT'
  ) THEN
    RAISE EXCEPTION 'Product edit permission required.';
  END IF;

  PERFORM set_config('app.current_user', p_actor_id::text, true);
  UPDATE public.product
  SET description = btrim(p_description),
      unit = btrim(p_unit)
  WHERE prod_code = p_prod_code
    AND status = 'Active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found or inactive.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.edit_product_form(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.edit_product_form(uuid, text, text, text) TO service_role;
NOTIFY pgrst, 'reload schema';
