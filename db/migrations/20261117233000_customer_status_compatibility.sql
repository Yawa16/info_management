-- Coordinate this migration with the DB Admin and existing Customer clients.
-- This targets the legacy schema with custno and is_deleted; RLS denies direct
-- client access, while the application's authorized server uses the service role.

LOCK TABLE public.customer IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.customer WHERE is_deleted) THEN
    RAISE EXCEPTION 'Migration requires a reviewed backfill for inactive customers.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customer'
  ) THEN
    RAISE EXCEPTION 'Customer policies already exist; review direct access before migration.';
  END IF;
END;
$$;

ALTER TABLE public.customer RENAME COLUMN custno TO cust_no;
ALTER TABLE public.customer RENAME COLUMN custname TO cust_name;
ALTER TABLE public.customer RENAME COLUMN payterm TO pay_terms;

ALTER TABLE public.customer
  ADD COLUMN status text NOT NULL DEFAULT 'Active',
  ADD CONSTRAINT customer_status_check CHECK (status IN ('Active', 'Inactive')),
  ADD CONSTRAINT customer_status_matches_deleted CHECK (
    (status = 'Inactive') = is_deleted
  );
-- The insert trigger derives a value when callers omit status.
ALTER TABLE public.customer ALTER COLUMN status DROP DEFAULT;

CREATE FUNCTION public.customer_sync_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS NULL THEN
      NEW.status := CASE WHEN NEW.is_deleted THEN 'Inactive' ELSE 'Active' END;
    ELSE
      IF NEW.status NOT IN ('Active', 'Inactive') THEN
        RAISE EXCEPTION 'Invalid customer status.';
      END IF;
      NEW.is_deleted := NEW.status = 'Inactive';
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IS NULL OR NEW.status NOT IN ('Active', 'Inactive') THEN
      RAISE EXCEPTION 'Invalid customer status.';
    END IF;
    IF NEW.is_deleted IS DISTINCT FROM OLD.is_deleted
       AND NEW.is_deleted IS DISTINCT FROM (NEW.status = 'Inactive') THEN
      RAISE EXCEPTION 'Conflicting customer status and is_deleted values.';
    END IF;
    NEW.is_deleted := NEW.status = 'Inactive';
  ELSIF NEW.is_deleted IS DISTINCT FROM OLD.is_deleted THEN
    NEW.status := CASE WHEN NEW.is_deleted THEN 'Inactive' ELSE 'Active' END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER aa_customer_sync_status
BEFORE INSERT OR UPDATE ON public.customer
FOR EACH ROW EXECUTE FUNCTION public.customer_sync_status();

CREATE FUNCTION public.customer_check_active_sales()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  active_sales bigint;
BEGIN
  IF NEW.is_deleted AND NOT OLD.is_deleted THEN
    SELECT count(*) INTO active_sales
    FROM public.sales
    WHERE custno = OLD.cust_no AND NOT is_deleted;
    IF active_sales > 0 THEN
      RAISE EXCEPTION 'Cannot delete customer row: % active related record(s) still exist.', active_sales;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER customer_bu_check ON public.customer;
CREATE TRIGGER customer_bu_check
BEFORE UPDATE ON public.customer
FOR EACH ROW EXECUTE FUNCTION public.customer_check_active_sales();

DROP TRIGGER zz_audit_legacy_log_customer ON public.customer;
CREATE TRIGGER zz_audit_legacy_log_customer
AFTER INSERT OR UPDATE OR DELETE ON public.customer
FOR EACH ROW EXECUTE FUNCTION public.audit_record_change('cust_no');

ALTER TABLE public.customer ENABLE ROW LEVEL SECURITY;
NOTIFY pgrst, 'reload schema';
