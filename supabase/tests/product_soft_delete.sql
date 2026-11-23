-- Run only against an approved test database after applying the soft-delete migration.
-- Product, price-history, and rights changes are rolled back.
BEGIN;

DO $$
DECLARE
  manager uuid;
  regular_user uuid;
  delete_right bigint;
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
  SELECT id INTO delete_right FROM public.rights WHERE code = 'PRODUCT_DELETE';
  IF manager IS NULL OR regular_user IS NULL OR delete_right IS NULL THEN
    RAISE EXCEPTION 'Test requires an active Admin, regular user, and Product Delete right.';
  END IF;

  product_code := public.save_product_form(manager, 'Product soft delete test', 'pair');
  INSERT INTO public.pricehist (prodcode, effdate, unitprice)
  VALUES (product_code, current_date, 12.34);
  DELETE FROM public.user_rights
  WHERE user_id = regular_user AND right_id = delete_right;

  rejected := false;
  BEGIN
    PERFORM public.soft_delete_product(regular_user, product_code);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Product delete permission required.' THEN RAISE; END IF;
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Delete without PRODUCT_DELETE was accepted.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.product WHERE prod_code = product_code AND status = 'Active'
  ) THEN
    RAISE EXCEPTION 'Refused delete changed the product.';
  END IF;

  INSERT INTO public.user_rights (user_id, right_id, granted_by)
  VALUES (regular_user, delete_right, manager);
  PERFORM public.soft_delete_product(regular_user, product_code);
  SELECT stamp INTO current_stamp FROM public.product
  WHERE prod_code = product_code AND status = 'Inactive' AND is_deleted;
  IF current_stamp IS NULL OR current_stamp NOT LIKE ('DELETED ' || regular_user::text || ' %') THEN
    RAISE EXCEPTION 'Soft-deleted product or stamp was incorrect.';
  END IF;
  SELECT unitprice INTO current_price FROM public.pricehist
  WHERE prodcode = product_code AND effdate = current_date AND NOT is_deleted;
  IF current_price IS DISTINCT FROM 12.34 THEN
    RAISE EXCEPTION 'Price history was changed or removed by deletion.';
  END IF;

  IF has_function_privilege('anon', 'public.soft_delete_product(uuid,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.soft_delete_product(uuid,text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.soft_delete_product(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected soft-delete function privileges.';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.product'::regclass) THEN
    RAISE EXCEPTION 'Product RLS is disabled.';
  END IF;
END;
$$;

ROLLBACK;
