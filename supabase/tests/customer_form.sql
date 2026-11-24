-- Run only against an approved test database after applying the Task 2 migration.
-- All Customer and audit changes are rolled back.
BEGIN;

DO $$
DECLARE
  actor uuid;
  next_number bigint;
  expected_number text;
  created_number text;
  legacy_number text;
  current_stamp text;
  blocked boolean;
  term text;
BEGIN
  SELECT id INTO actor FROM public.profiles
  WHERE NOT is_blocked AND approval_status IN ('active', 'approved') LIMIT 1;
  IF actor IS NULL THEN RAISE EXCEPTION 'No active account available for test.'; END IF;

  SELECT coalesce(max(substring(cust_no FROM 3)::bigint), 0) + 1
  INTO next_number FROM public.customer WHERE cust_no ~ '^C-[0-9]{1,8}$';
  expected_number := 'C-' || lpad(next_number::text, greatest(3, length(next_number::text)), '0');
  created_number := public.save_customer_form(actor, NULL, 'Customer form test', NULL, 'COD');
  IF created_number <> expected_number THEN RAISE EXCEPTION 'Customer number was not sequential.'; END IF;
  SELECT stamp INTO current_stamp FROM public.customer
  WHERE cust_no = created_number AND status = 'Active';
  IF current_stamp IS NULL OR current_stamp NOT LIKE ('CREATED ' || actor::text || ' %') THEN
    RAISE EXCEPTION 'Created status or stamp was incorrect.';
  END IF;

  PERFORM public.save_customer_form(actor, created_number, 'Customer form edited', 'Test address', 'Net 30');
  SELECT stamp INTO current_stamp FROM public.customer
  WHERE cust_no = created_number AND cust_name = 'Customer form edited';
  IF current_stamp IS NULL OR current_stamp NOT LIKE ('EDITED ' || actor::text || ' %') THEN
    RAISE EXCEPTION 'Edited stamp was incorrect.';
  END IF;

  SELECT cust_no INTO legacy_number FROM public.customer
  WHERE status = 'Active' AND cust_no !~ '^C-[0-9]{1,8}$' LIMIT 1;
  IF legacy_number IS NULL THEN RAISE EXCEPTION 'No active legacy Customer available for test.'; END IF;
  PERFORM public.save_customer_form(actor, legacy_number, 'Legacy customer test', NULL, 'Prepaid');

  FOREACH term IN ARRAY ARRAY['Net 15', 'Net 30', 'Net 45', 'COD', 'Prepaid'] LOOP
    PERFORM public.save_customer_form(actor, created_number, repeat('N', 100), repeat('A', 200), term);
    IF NOT EXISTS (SELECT 1 FROM public.customer WHERE cust_no = created_number
      AND cust_name = repeat('N', 100) AND address = repeat('A', 200) AND pay_terms = term) THEN
      RAISE EXCEPTION 'Customer fields or payment term were not saved.';
    END IF;
  END LOOP;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.customer'::regclass) THEN
    RAISE EXCEPTION 'Customer RLS is disabled.';
  END IF;
  blocked := false;
  BEGIN
    PERFORM public.save_customer_form(actor, NULL, '', NULL, 'COD');
  EXCEPTION WHEN raise_exception THEN
    blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Empty customer name was accepted.'; END IF;
  IF has_function_privilege('anon', 'public.save_customer_form(uuid,text,text,text,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.save_customer_form(uuid,text,text,text,text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.save_customer_form(uuid,text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected customer form function privileges.';
  END IF;
END;
$$;

SET LOCAL ROLE anon;
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.customer', 'SELECT')
    AND EXISTS (SELECT 1 FROM public.customer_active) THEN
    RAISE EXCEPTION 'Anonymous role can read customers through customer_active.';
  END IF;
END;
$$;
RESET ROLE;

ROLLBACK;
