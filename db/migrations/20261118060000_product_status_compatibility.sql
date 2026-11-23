-- Coordinate this migration with the DB Admin and existing Product clients.
-- This targets the legacy schema with prodcode and is_deleted; RLS denies direct
-- client access, while the application's authorized server uses the service role.

LOCK TABLE public.product IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.product WHERE is_deleted) THEN
    RAISE EXCEPTION 'Migration requires a reviewed backfill for inactive products.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product'
  ) THEN
    RAISE EXCEPTION 'Product policies already exist; review direct access before migration.';
  END IF;
END;
$$;

-- The legacy view runs with its owner's rights and would bypass RLS.
DROP VIEW public.product_active;

ALTER TABLE public.product RENAME COLUMN prodcode TO prod_code;

ALTER TABLE public.product
  ADD COLUMN status text NOT NULL DEFAULT 'Active',
  ADD CONSTRAINT product_status_check CHECK (status IN ('Active', 'Inactive')),
  ADD CONSTRAINT product_status_matches_deleted CHECK (
    (status = 'Inactive') = is_deleted
  );
-- The insert trigger derives a value when callers omit status.
ALTER TABLE public.product ALTER COLUMN status DROP DEFAULT;

CREATE FUNCTION public.product_sync_status()
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
        RAISE EXCEPTION 'Invalid product status.';
      END IF;
      NEW.is_deleted := NEW.status = 'Inactive';
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IS NULL OR NEW.status NOT IN ('Active', 'Inactive') THEN
      RAISE EXCEPTION 'Invalid product status.';
    END IF;
    IF NEW.is_deleted IS DISTINCT FROM OLD.is_deleted
       AND NEW.is_deleted IS DISTINCT FROM (NEW.status = 'Inactive') THEN
      RAISE EXCEPTION 'Conflicting product status and is_deleted values.';
    END IF;
    NEW.is_deleted := NEW.status = 'Inactive';
  ELSIF NEW.is_deleted IS DISTINCT FROM OLD.is_deleted THEN
    NEW.status := CASE WHEN NEW.is_deleted THEN 'Inactive' ELSE 'Active' END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER aa_product_sync_status
BEFORE INSERT OR UPDATE ON public.product
FOR EACH ROW EXECUTE FUNCTION public.product_sync_status();

-- The shared guard still reads the old column name for Product.
CREATE FUNCTION public.product_check_active_children()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  active_children bigint;
BEGIN
  IF NEW.is_deleted AND NOT OLD.is_deleted THEN
    SELECT count(*) INTO active_children FROM (
      SELECT 1 FROM public.salesdetail WHERE prodcode = OLD.prod_code AND NOT is_deleted
      UNION ALL
      SELECT 1 FROM public.pricehist WHERE prodcode = OLD.prod_code AND NOT is_deleted
    ) c;
    IF active_children > 0 THEN
      RAISE EXCEPTION 'Cannot delete product row: % active related record(s) still exist.', active_children;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER product_bu_check ON public.product;
CREATE TRIGGER product_bu_check
BEFORE UPDATE ON public.product
FOR EACH ROW EXECUTE FUNCTION public.product_check_active_children();

DROP TRIGGER zz_audit_legacy_log_product ON public.product;
CREATE TRIGGER zz_audit_legacy_log_product
AFTER INSERT OR UPDATE OR DELETE ON public.product
FOR EACH ROW EXECUTE FUNCTION public.audit_record_change('prod_code');

CREATE VIEW public.product_active WITH (security_invoker = true) AS
  SELECT prod_code AS prodcode, description, unit, is_deleted, stamp
  FROM public.product WHERE NOT is_deleted;
ALTER VIEW public.product_active OWNER TO postgres;
GRANT ALL ON public.product_active TO anon, authenticated, service_role;

ALTER TABLE public.product ENABLE ROW LEVEL SECURITY;
NOTIFY pgrst, 'reload schema';
