-- Recreate the legacy views without CASCADE; the Customer view must obey RLS.
DROP VIEW public.customer_active;
DROP VIEW public.sales_active;

ALTER TABLE public.customer
  ALTER COLUMN cust_no TYPE varchar(10),
  ALTER COLUMN cust_name TYPE varchar(100),
  ALTER COLUMN address TYPE varchar(200),
  ALTER COLUMN pay_terms TYPE varchar(20),
  DROP CONSTRAINT pay_ck,
  ADD CONSTRAINT pay_ck CHECK (
    pay_terms IN ('COD', '30D', '45D', 'Net 15', 'Net 30', 'Net 45', 'Prepaid')
  );
ALTER TABLE public.sales ALTER COLUMN custno TYPE varchar(10);

CREATE VIEW public.customer_active WITH (security_invoker = true) AS
  SELECT cust_no AS custno, cust_name AS custname, address,
    pay_terms AS payterm, is_deleted, stamp
  FROM public.customer WHERE NOT is_deleted;
CREATE VIEW public.sales_active AS
  SELECT transno, salesdate, custno, empno, is_deleted, stamp
  FROM public.sales WHERE NOT is_deleted;
ALTER VIEW public.customer_active OWNER TO postgres;
ALTER VIEW public.sales_active OWNER TO postgres;
GRANT ALL ON public.customer_active, public.sales_active TO anon, authenticated, service_role;

-- Only the trusted server may invoke this function after checking action rights.
CREATE FUNCTION public.save_customer_form(
  p_actor_id uuid,
  p_cust_no text,
  p_name text,
  p_address text,
  p_pay_terms text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  next_number bigint;
  customer_number text;
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_actor_id AND NOT is_blocked
      AND approval_status IN ('active', 'approved')
  ) THEN
    RAISE EXCEPTION 'Invalid customer action actor.';
  END IF;
  IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 100
    OR (p_address IS NOT NULL AND length(btrim(p_address)) > 200)
    OR (p_pay_terms IS NOT NULL AND p_pay_terms NOT IN ('Net 15', 'Net 30', 'Net 45', 'COD', 'Prepaid')) THEN
    RAISE EXCEPTION 'Invalid customer fields.';
  END IF;
  PERFORM set_config('app.current_user', p_actor_id::text, true);

  IF p_cust_no IS NULL THEN
    PERFORM pg_advisory_xact_lock(684220);
    SELECT coalesce(max(substring(cust_no FROM 3)::bigint), 0) + 1
      INTO next_number FROM public.customer
      WHERE cust_no ~ '^C-[0-9]{1,8}$';
    IF next_number > 99999999 THEN
      RAISE EXCEPTION 'Customer number capacity exhausted.';
    END IF;
    customer_number := 'C-' || lpad(next_number::text, greatest(3, length(next_number::text)), '0');
    INSERT INTO public.customer (cust_no, cust_name, address, pay_terms, status)
    VALUES (customer_number, btrim(p_name), nullif(btrim(p_address), ''), p_pay_terms, 'Active');
  ELSE
    IF length(btrim(p_cust_no)) = 0 OR length(p_cust_no) > 10 THEN
      RAISE EXCEPTION 'Invalid customer number.';
    END IF;
    UPDATE public.customer
    SET cust_name = btrim(p_name), address = nullif(btrim(p_address), ''), pay_terms = p_pay_terms
    WHERE cust_no = p_cust_no AND status = 'Active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Customer not found or inactive.';
    END IF;
    customer_number := p_cust_no;
  END IF;
  RETURN customer_number;
END;
$$;

REVOKE ALL ON FUNCTION public.save_customer_form(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_customer_form(uuid, text, text, text, text) TO service_role;
NOTIFY pgrst, 'reload schema';
