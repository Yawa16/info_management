-- Sprint 2 DB task 08: ready-made, role-gated Customer and Product views.
-- This migration follows 007, so status and stamp are canonical on every
-- Customer and Product row. Product current prices are derived directly with
-- the proven lateral-price query; a future DBA migration may extract this into
-- a shared function without changing these view columns.

CREATE VIEW public.v_customer_active
WITH (security_invoker = true, security_barrier = true)
AS
SELECT cust_no, cust_name, address, pay_terms
FROM public.customer
WHERE public.current_app_access_role() = 'User'
  AND status = 'Active';

DROP VIEW public.v_customer_admin;
CREATE VIEW public.v_customer_admin
WITH (security_invoker = true, security_barrier = true)
AS
SELECT cust_no, cust_name, address, pay_terms, status, stamp
FROM public.customer
WHERE public.current_app_access_role() IN ('Admin', 'Superadmin');

DROP VIEW public.v_product_admin;

-- Support the canonical migration names and the deployed legacy PRICEHIST names.
DO $$
DECLARE
    pricehist_code_column TEXT;
    pricehist_date_column TEXT;
    pricehist_amount_column TEXT;
BEGIN
    SELECT column_name INTO pricehist_code_column
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pricehist'
      AND column_name IN ('prod_code', 'prodcode')
    ORDER BY CASE column_name WHEN 'prod_code' THEN 1 ELSE 2 END
    LIMIT 1;

    SELECT column_name INTO pricehist_date_column
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pricehist'
      AND column_name IN ('eff_date', 'effdate')
    ORDER BY CASE column_name WHEN 'eff_date' THEN 1 ELSE 2 END
    LIMIT 1;

    SELECT column_name INTO pricehist_amount_column
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pricehist'
      AND column_name IN ('unit_price', 'unitprice')
    ORDER BY CASE column_name WHEN 'unit_price' THEN 1 ELSE 2 END
    LIMIT 1;

    IF pricehist_code_column IS NULL
       OR pricehist_date_column IS NULL
       OR pricehist_amount_column IS NULL THEN
        RAISE EXCEPTION
            'Cannot create Product views: required canonical or legacy PRICEHIST columns are missing.';
    END IF;

    EXECUTE format($view$
        CREATE VIEW public.v_product_active
        WITH (security_invoker = true, security_barrier = true)
        AS
        SELECT product.prod_code, product.description, product.unit,
               current_price.unit_price AS current_price
        FROM public.product AS product
        LEFT JOIN LATERAL (
            SELECT pricehist.%3$I AS unit_price
            FROM public.pricehist AS pricehist
            WHERE pricehist.%1$I = product.prod_code
              AND pricehist.%2$I <= CURRENT_DATE
              AND pricehist.status = 'Active'
            ORDER BY pricehist.%2$I DESC
            LIMIT 1
        ) AS current_price ON TRUE
        WHERE public.current_app_access_role() = 'User'
          AND product.status = 'Active'
    $view$, pricehist_code_column, pricehist_date_column, pricehist_amount_column);

    EXECUTE format($view$
        CREATE VIEW public.v_product_admin
        WITH (security_invoker = true, security_barrier = true)
        AS
        SELECT product.prod_code, product.description, product.unit,
               current_price.unit_price AS current_price,
               product.status, product.stamp
        FROM public.product AS product
        LEFT JOIN LATERAL (
            SELECT pricehist.%3$I AS unit_price
            FROM public.pricehist AS pricehist
            WHERE pricehist.%1$I = product.prod_code
              AND pricehist.%2$I <= CURRENT_DATE
              AND pricehist.status = 'Active'
            ORDER BY pricehist.%2$I DESC
            LIMIT 1
        ) AS current_price ON TRUE
        WHERE public.current_app_access_role() IN ('Admin', 'Superadmin')
    $view$, pricehist_code_column, pricehist_date_column, pricehist_amount_column);
END;
$$;

-- These small, role-gated result sets are ready-made inputs for the status tabs.
CREATE VIEW public.v_customer_status_counts
WITH (security_invoker = true, security_barrier = true)
AS
SELECT status_filter,
       CASE status_filter
           WHEN 'Active' THEN count_active
           WHEN 'Inactive' THEN count_inactive
           ELSE count_all
       END AS row_count
FROM (
    SELECT
        count(*) FILTER (WHERE status = 'Active') AS count_active,
        count(*) FILTER (WHERE status = 'Inactive') AS count_inactive,
        count(*) AS count_all
    FROM public.customer
) AS totals
CROSS JOIN (VALUES ('Active'), ('Inactive'), ('All')) AS filters(status_filter)
WHERE public.current_app_access_role() IN ('Admin', 'Superadmin');

CREATE VIEW public.v_product_status_counts
WITH (security_invoker = true, security_barrier = true)
AS
SELECT status_filter,
       CASE status_filter
           WHEN 'Active' THEN count_active
           WHEN 'Inactive' THEN count_inactive
           ELSE count_all
       END AS row_count
FROM (
    SELECT
        count(*) FILTER (WHERE status = 'Active') AS count_active,
        count(*) FILTER (WHERE status = 'Inactive') AS count_inactive,
        count(*) AS count_all
    FROM public.product
) AS totals
CROSS JOIN (VALUES ('Active'), ('Inactive'), ('All')) AS filters(status_filter)
WHERE public.current_app_access_role() IN ('Admin', 'Superadmin');

COMMENT ON VIEW public.v_customer_active IS
    'Security-invoker User view: Active customers only, with no Status or Stamp columns.';
COMMENT ON VIEW public.v_customer_admin IS
    'Security-invoker Admin/Superadmin view: all customers with Status and Stamp.';
COMMENT ON VIEW public.v_product_active IS
    'Security-invoker User view: Active products with current price derived from active PRICEHIST rows, without Status or Stamp.';
COMMENT ON VIEW public.v_product_admin IS
    'Security-invoker Admin/Superadmin view: all products with derived current price, Status, and Stamp.';
COMMENT ON VIEW public.v_customer_status_counts IS
    'Active, Inactive, and All Customer tab counts for Admin/Superadmin contexts.';
COMMENT ON VIEW public.v_product_status_counts IS
    'Active, Inactive, and All Product tab counts for Admin/Superadmin contexts.';

-- Partial indexes serve the status-filtered list paths directly.
CREATE INDEX IF NOT EXISTS customer_active_partial_idx
    ON public.customer (cust_no)
    WHERE status = 'Active';
COMMENT ON INDEX public.customer_active_partial_idx IS
    'Serves Customer active-filtered lists and v_customer_active by cust_no.';

CREATE INDEX IF NOT EXISTS product_active_partial_idx
    ON public.product (prod_code)
    WHERE status = 'Active';
COMMENT ON INDEX public.product_active_partial_idx IS
    'Serves Product active-filtered lists and v_product_active by prod_code.';

-- PRICEHIST is looked up newest-effective-first for a product.
-- Create only missing indexes, using the canonical or legacy foreign-key names.
DO $$
DECLARE
    pricehist_code_column TEXT;
    pricehist_date_column TEXT;
    sales_customer_column TEXT;
    salesdetail_product_column TEXT;
BEGIN
    SELECT column_name INTO pricehist_code_column
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pricehist'
      AND column_name IN ('prod_code', 'prodcode')
    ORDER BY CASE column_name WHEN 'prod_code' THEN 1 ELSE 2 END
    LIMIT 1;

    SELECT column_name INTO pricehist_date_column
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pricehist'
      AND column_name IN ('eff_date', 'effdate')
    ORDER BY CASE column_name WHEN 'eff_date' THEN 1 ELSE 2 END
    LIMIT 1;

    SELECT column_name INTO sales_customer_column
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales'
      AND column_name IN ('cust_no', 'custno')
    ORDER BY CASE column_name WHEN 'cust_no' THEN 1 ELSE 2 END
    LIMIT 1;

    SELECT column_name INTO salesdetail_product_column
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'salesdetail'
      AND column_name IN ('prod_code', 'prodcode')
    ORDER BY CASE column_name WHEN 'prod_code' THEN 1 ELSE 2 END
    LIMIT 1;

    IF pricehist_code_column IS NULL OR pricehist_date_column IS NULL
       OR sales_customer_column IS NULL OR salesdetail_product_column IS NULL THEN
        RAISE EXCEPTION
            'Cannot create Sprint 2 indexes: a required canonical or legacy lookup column is missing.';
    END IF;

    EXECUTE format(
        'CREATE INDEX IF NOT EXISTS pricehist_active_product_effdate_desc_idx
         ON public.pricehist (%I, %I DESC) WHERE status = %L',
        pricehist_code_column, pricehist_date_column, 'Active'
    );
    COMMENT ON INDEX public.pricehist_active_product_effdate_desc_idx IS
        'Serves ORDER BY effective date DESC for the latest active price lookup per product.';

    IF NOT EXISTS (
        SELECT 1
        FROM pg_index index_meta
        WHERE index_meta.indrelid = 'public.sales'::regclass
          AND index_meta.indisvalid
          AND index_meta.indkey[0] = (
              SELECT attnum FROM pg_attribute
              WHERE attrelid = 'public.sales'::regclass
                AND attname = sales_customer_column
          )
    ) THEN
        EXECUTE format('CREATE INDEX sales_customer_lookup_idx ON public.sales (%I)', sales_customer_column);
        COMMENT ON INDEX public.sales_customer_lookup_idx IS
            'Serves the Customer delete guard query filtering SALES by its customer foreign key.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_index index_meta
        WHERE index_meta.indrelid = 'public.salesdetail'::regclass
          AND index_meta.indisvalid
          AND index_meta.indkey[0] = (
              SELECT attnum FROM pg_attribute
              WHERE attrelid = 'public.salesdetail'::regclass
                AND attname = salesdetail_product_column
          )
    ) THEN
        EXECUTE format('CREATE INDEX salesdetail_product_lookup_idx ON public.salesdetail (%I)', salesdetail_product_column);
        COMMENT ON INDEX public.salesdetail_product_lookup_idx IS
            'Serves the Product delete guard query filtering SALESDETAIL by its product foreign key.';
    END IF;
END;
$$;

REVOKE ALL ON TABLE
    public.v_customer_active,
    public.v_customer_admin,
    public.v_product_active,
    public.v_product_admin,
    public.v_customer_status_counts,
    public.v_product_status_counts
FROM PUBLIC;

DO $$
DECLARE
    application_role TEXT;
BEGIN
    FOREACH application_role IN ARRAY ARRAY['hope_app', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = application_role) THEN
            EXECUTE format(
                'GRANT SELECT ON TABLE public.v_customer_active,
                 public.v_customer_admin,
                 public.v_product_active,
                 public.v_product_admin,
                 public.v_customer_status_counts,
                 public.v_product_status_counts TO %I',
                application_role
            );
        END IF;
    END LOOP;
END;
$$;
