-- Run only against an approved test database after applying the Task 3 migration.
-- Customer, rights, and audit changes are rolled back.
BEGIN;

DO $$
DECLARE
  manager uuid;
  regular_user uuid;
  delete_right bigint;
  customer_number text;
  current_stamp text;
  rejected boolean;
BEGIN
  SELECT id INTO manager FROM public.profiles
  WHERE role = 'admin' AND NOT is_blocked
    AND approval_status IN ('active', 'approved') LIMIT 1;
  SELECT id INTO regular_user FROM public.profiles
  WHERE role = 'user' AND NOT is_blocked
    AND approval_status IN ('active', 'approved') LIMIT 1;
  SELECT id INTO delete_right FROM public.rights WHERE code = 'CUSTOMER_DELETE';
  IF manager IS NULL OR regular_user IS NULL OR delete_right IS NULL THEN
    RAISE EXCEPTION 'Test requires an active Admin, regular user, and Customer Delete right.';
  END IF;

  customer_number := public.save_customer_form(manager, NULL, 'Customer status test', NULL, 'COD');
  DELETE FROM public.user_rights WHERE user_id = regular_user AND right_id = delete_right;
  rejected := false;
  BEGIN
    PERFORM public.change_customer_status(regular_user, customer_number, 'delete');
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Customer delete permission required.' THEN RAISE; END IF;
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Delete without the right was accepted.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customer WHERE cust_no = customer_number AND status = 'Active') THEN
    RAISE EXCEPTION 'Refused delete changed the customer.';
  END IF;

  INSERT INTO public.user_rights (user_id, right_id, granted_by)
  VALUES (regular_user, delete_right, manager);
  PERFORM public.change_customer_status(regular_user, customer_number, 'delete');
  SELECT stamp INTO current_stamp FROM public.customer
  WHERE cust_no = customer_number AND status = 'Inactive' AND is_deleted;
  IF current_stamp IS NULL OR current_stamp NOT LIKE ('DELETED ' || regular_user::text || ' %') THEN
    RAISE EXCEPTION 'Soft-deleted customer or stamp was incorrect.';
  END IF;

  rejected := false;
  BEGIN
    PERFORM public.change_customer_status(regular_user, customer_number, 'restore');
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Only managers can restore customers.' THEN RAISE; END IF;
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Regular user restore was accepted.'; END IF;
  PERFORM public.change_customer_status(manager, customer_number, 'restore');
  SELECT stamp INTO current_stamp FROM public.customer
  WHERE cust_no = customer_number AND status = 'Active' AND NOT is_deleted;
  IF current_stamp IS NULL OR current_stamp NOT LIKE ('RESTORED ' || manager::text || ' %') THEN
    RAISE EXCEPTION 'Restored customer or stamp was incorrect.';
  END IF;

  rejected := false;
  BEGIN
    PERFORM public.change_customer_status(manager, customer_number, 'restore');
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Customer not found or status already changed.' THEN RAISE; END IF;
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Repeated restore was accepted.'; END IF;

  IF has_function_privilege('anon', 'public.change_customer_status(uuid,text,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.change_customer_status(uuid,text,text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.change_customer_status(uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected customer status function privileges.';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.customer'::regclass) THEN
    RAISE EXCEPTION 'Customer RLS is disabled.';
  END IF;
END;
$$;

ROLLBACK;
