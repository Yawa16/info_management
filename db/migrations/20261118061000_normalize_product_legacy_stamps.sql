-- Preserve the original actor and time; audit the formatting-only update.
LOCK TABLE public.product IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  expected_triggers integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.product
    WHERE stamp LIKE 'ADD %'
      AND stamp !~ '^ADD (.* [0-9]{4}-[0-9]{2}-[0-9]{2}) 0?([1-9]|1[0-2]):([0-5][0-9] (AM|PM))$'
  ) THEN
    RAISE EXCEPTION 'Unrecognized legacy Product stamp; manual review required.';
  END IF;

  SELECT count(*) INTO expected_triggers
  FROM pg_trigger t
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE t.tgrelid = 'public.product'::regclass
    AND NOT t.tgisinternal AND t.tgenabled = 'O'
    AND (t.tgname, p.proname) IN (
      ('product_biu_stamp', 'trg_set_stamp'),
      ('zz_audit_legacy_stamp_product', 'audit_set_stamp'),
      ('zz_audit_legacy_log_product', 'audit_record_change')
    );
  IF expected_triggers <> 3 THEN
    RAISE EXCEPTION 'Expected Product stamp and audit triggers are not enabled.';
  END IF;
END;
$$;

CREATE TEMP TABLE product_legacy_stamp_backup ON COMMIT DROP AS
SELECT prod_code, stamp AS original_stamp
FROM public.product
WHERE stamp LIKE 'ADD %';

ALTER TABLE public.product DISABLE TRIGGER product_biu_stamp;
ALTER TABLE public.product DISABLE TRIGGER zz_audit_legacy_stamp_product;

UPDATE public.product
SET stamp = regexp_replace(
  stamp,
  '^ADD (.* [0-9]{4}-[0-9]{2}-[0-9]{2}) 0?([1-9]|1[0-2]):([0-5][0-9] (AM|PM))$',
  E'CREATED \\1 \\2:\\3'
)
WHERE stamp LIKE 'ADD %';

ALTER TABLE public.product ENABLE TRIGGER product_biu_stamp;
ALTER TABLE public.product ENABLE TRIGGER zz_audit_legacy_stamp_product;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM product_legacy_stamp_backup b
    LEFT JOIN public.product p USING (prod_code)
    WHERE p.prod_code IS NULL OR p.stamp IS DISTINCT FROM regexp_replace(
      'CREATED ' || substring(b.original_stamp FROM 5),
      ' 0([1-9]):([0-5][0-9] (AM|PM))$',
      E' \\1:\\2'
    )
  ) OR EXISTS (SELECT 1 FROM public.product WHERE stamp LIKE 'ADD %') THEN
    RAISE EXCEPTION 'Legacy Product stamp normalization failed.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM product_legacy_stamp_backup b
    JOIN public.product p USING (prod_code)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.audit_log a
      WHERE a.table_name = 'product' AND a.action = 'EDITED'
        AND a.occurred_at = transaction_timestamp()
        AND a.old_values ->> 'prod_code' = b.prod_code
        AND a.old_values ->> 'stamp' = b.original_stamp
        AND a.new_values ->> 'stamp' = p.stamp
        AND a.old_values - 'stamp' = a.new_values - 'stamp'
    )
  ) THEN
    RAISE EXCEPTION 'Missing audit record for Product stamp normalization.';
  END IF;
END;
$$;
