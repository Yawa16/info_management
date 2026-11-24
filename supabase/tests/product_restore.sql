-- Run only against an approved test database after applying the Product
-- soft-delete and restore migrations. All fixture and audit changes roll back.
BEGIN;

DO $$
DECLARE
  manager uuid;
  regular_user uuid;
  product_code text;
  current_stamp text;
  current_price numeric;
  rejected boolean;
BEGIN
  SELECT id INTO manager FROM public.profiles
  WHERE role = 'admin' AND NOT is_blocked
    AND approval_status IN ('active', 'approved') LIMIT 1;
  SELECT id INTO regular_user FROM public.profiles
  WHERE role = 'user' AND NOT is_blocked
    AND approval_status IN ('active', 'approved') LIMIT 1;
  IF manager IS NULL OR regular_user IS NULL THEN
    RAISE EXCEPTION 'Test requires an active Admin and regular User.';
  END IF;

  product_code := public.save_product_form(manager, 'Product restore test', 'pair');
  INSERT INTO public.pricehist (prodcode, effdate, unitprice)
  VALUES (product_code, current_date, 12.34);
  PERFORM public.soft_delete_product(manager, product_code);

  SELECT stamp INTO current_stamp FROM public.product
  WHERE prod_code = product_code AND status = 'Inactive' AND is_deleted;
  IF current_stamp IS NULL OR current_stamp NOT LIKE ('DELETED ' || manager::text || ' %') THEN
    RAISE EXCEPTION 'Test product was not soft-deleted correctly.';
  END IF;

  rejected := false;
  BEGIN
    PERFORM public.restore_product(regular_user, product_code);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Only managers can restore products.' THEN RAISE; END IF;
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Restore by a regular User was accepted.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.product WHERE prod_code = product_code AND status = 'Inactive' AND is_deleted
  ) THEN
    RAISE EXCEPTION 'Refused restore changed the product.';
  END IF;

  PERFORM public.restore_product(manager, product_code);
  SELECT stamp INTO current_stamp FROM public.product
  WHERE prod_code = product_code AND status = 'Active' AND NOT is_deleted;
  IF current_stamp IS NULL OR current_stamp NOT LIKE ('RESTORED ' || manager::text || ' %') THEN
    RAISE EXCEPTION 'Restored product or stamp was incorrect.';
  END IF;
  SELECT unitprice INTO current_price FROM public.pricehist
  WHERE prodcode = product_code AND effdate = current_date AND NOT is_deleted;
  IF current_price IS DISTINCT FROM 12.34 THEN
    RAISE EXCEPTION 'Price history was changed or removed by restore.';
  END IF;

  rejected := false;
  BEGIN
    PERFORM public.restore_product(manager, product_code);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Product not found or already active.' THEN RAISE; END IF;
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Repeated restore was accepted.'; END IF;

  IF has_function_privilege('anon', 'public.restore_product(uuid,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.restore_product(uuid,text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.restore_product(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected restore function privileges.';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.product'::regclass) THEN
    RAISE EXCEPTION 'Product RLS is disabled.';
  END IF;
END;
$$;

ROLLBACK;
