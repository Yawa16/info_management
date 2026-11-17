-- Preserve the original actor and time; audit the formatting-only update.
LOCK TABLE public.customer IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  expected_triggers integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.customer
    WHERE stamp LIKE 'ADD %'
      AND stamp !~ '^ADD (.* [0-9]{4}-[0-9]{2}-[0-9]{2}) 0?([1-9]|1[0-2]):([0-5][0-9] (AM|PM))$'
  ) THEN
    RAISE EXCEPTION 'Unrecognized legacy Customer stamp; manual review required.';
  END IF;

  SELECT count(*) INTO expected_triggers
  FROM pg_trigger t
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE t.tgrelid = 'public.customer'::regclass
    AND NOT t.tgisinternal AND t.tgenabled = 'O'
    AND (t.tgname, p.proname) IN (
      ('customer_biu_stamp', 'trg_set_stamp'),
      ('zz_audit_legacy_stamp_customer', 'audit_set_stamp'),
      ('zz_audit_legacy_log_customer', 'audit_record_change')
    );
  IF expected_triggers <> 3 THEN
    RAISE EXCEPTION 'Expected Customer stamp and audit triggers are not enabled.';
  END IF;
END;
$$;

CREATE TEMP TABLE customer_legacy_stamp_backup ON COMMIT DROP AS
SELECT cust_no, stamp AS original_stamp
FROM public.customer
WHERE stamp LIKE 'ADD %';

ALTER TABLE public.customer DISABLE TRIGGER customer_biu_stamp;
ALTER TABLE public.customer DISABLE TRIGGER zz_audit_legacy_stamp_customer;

UPDATE public.customer
SET stamp = regexp_replace(
  stamp,
  '^ADD (.* [0-9]{4}-[0-9]{2}-[0-9]{2}) 0?([1-9]|1[0-2]):([0-5][0-9] (AM|PM))$',
  E'CREATED \\1 \\2:\\3'
)
WHERE stamp LIKE 'ADD %';

ALTER TABLE public.customer ENABLE TRIGGER customer_biu_stamp;
ALTER TABLE public.customer ENABLE TRIGGER zz_audit_legacy_stamp_customer;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM customer_legacy_stamp_backup b
    LEFT JOIN public.customer c USING (cust_no)
    WHERE c.cust_no IS NULL OR c.stamp IS DISTINCT FROM regexp_replace(
      'CREATED ' || substring(b.original_stamp FROM 5),
      ' 0([1-9]):([0-5][0-9] (AM|PM))$',
      E' \\1:\\2'
    )
  ) OR EXISTS (SELECT 1 FROM public.customer WHERE stamp LIKE 'ADD %') THEN
    RAISE EXCEPTION 'Legacy Customer stamp normalization failed.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM customer_legacy_stamp_backup b
    JOIN public.customer c USING (cust_no)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.audit_log a
      WHERE a.table_name = 'customer' AND a.action = 'EDITED'
        AND a.occurred_at = transaction_timestamp()
        AND a.old_values ->> 'cust_no' = b.cust_no
        AND a.old_values ->> 'stamp' = b.original_stamp
        AND a.new_values ->> 'stamp' = c.stamp
        AND a.old_values - 'stamp' = a.new_values - 'stamp'
    )
  ) THEN
    RAISE EXCEPTION 'Missing audit record for Customer stamp normalization.';
  END IF;
END;
$$;
