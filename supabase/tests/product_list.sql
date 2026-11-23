-- Run only against an approved test database after applying both Product
-- migrations (status compatibility, then legacy stamp normalization).
-- All Product and audit changes are rolled back.
BEGIN;

DO $$
DECLARE
  actor uuid;
  rejected boolean;
  current_stamp text;
BEGIN
  SELECT id INTO actor FROM public.profiles
  WHERE NOT is_blocked AND approval_status IN ('active', 'approved') LIMIT 1;
  IF actor IS NULL THEN RAISE EXCEPTION 'No active account available for test.'; END IF;
  PERFORM set_config('app.current_user', actor::text, true);

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.product'::regclass) THEN
    RAISE EXCEPTION 'Product RLS is disabled.';
  END IF;
  IF NOT (SELECT reloptions @> ARRAY['security_invoker=true'] FROM pg_class WHERE oid = 'public.product_active'::regclass) THEN
    RAISE EXCEPTION 'product_active does not apply the caller''s RLS.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.product WHERE stamp LIKE 'ADD %') THEN
    RAISE EXCEPTION 'Legacy ADD stamps remain.';
  END IF;

  INSERT INTO public.product (prod_code, description, unit) VALUES ('T-001', 'Status test', 'pc');
  IF NOT EXISTS (SELECT 1 FROM public.product WHERE prod_code = 'T-001' AND status = 'Active' AND NOT is_deleted
    AND stamp LIKE ('CREATED ' || actor::text || ' %')) THEN
    RAISE EXCEPTION 'New product status or stamp was incorrect.';
  END IF;

  UPDATE public.product SET status = 'Inactive' WHERE prod_code = 'T-001';
  SELECT stamp INTO current_stamp FROM public.product WHERE prod_code = 'T-001' AND status = 'Inactive' AND is_deleted;
  IF current_stamp IS NULL OR current_stamp NOT LIKE ('DELETED ' || actor::text || ' %') THEN
    RAISE EXCEPTION 'Soft-deleted product or stamp was incorrect.';
  END IF;
  UPDATE public.product SET status = 'Active' WHERE prod_code = 'T-001';
  IF NOT EXISTS (SELECT 1 FROM public.product WHERE prod_code = 'T-001' AND status = 'Active' AND NOT is_deleted
    AND stamp LIKE ('RESTORED ' || actor::text || ' %')) THEN
    RAISE EXCEPTION 'Restored product or stamp was incorrect.';
  END IF;

  rejected := false;
  BEGIN
    UPDATE public.product SET status = 'Archived' WHERE prod_code = 'T-001';
  EXCEPTION WHEN raise_exception OR check_violation THEN
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Invalid status was accepted.'; END IF;

  -- Soft deletion must preserve related price history.
  INSERT INTO public.pricehist (prodcode, effdate, unitprice) VALUES ('T-001', current_date, 1);
  UPDATE public.product SET status = 'Inactive' WHERE prod_code = 'T-001';
  IF NOT EXISTS (
    SELECT 1 FROM public.product WHERE prod_code = 'T-001' AND status = 'Inactive' AND is_deleted
  ) OR NOT EXISTS (
    SELECT 1 FROM public.pricehist WHERE prodcode = 'T-001' AND effdate = current_date
      AND unitprice = 1 AND NOT is_deleted
  ) THEN
    RAISE EXCEPTION 'Soft deletion did not preserve the product and its price history.';
  END IF;
END;
$$;

SET LOCAL ROLE anon;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.product) OR EXISTS (SELECT 1 FROM public.product_active) THEN
    RAISE EXCEPTION 'Anonymous role can read products.';
  END IF;
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.product) OR EXISTS (SELECT 1 FROM public.product_active) THEN
    RAISE EXCEPTION 'Authenticated role can read products without a policy.';
  END IF;
END;
$$;
RESET ROLE;

ROLLBACK;
