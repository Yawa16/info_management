-- Sprint 2 customer, product, and price-history access rules.
-- The migration runner executes each numbered migration in one transaction.

-- Normalize legacy is_deleted tables without renaming columns used by existing
-- constraints, foreign keys, views, and audit triggers.
DO $$
DECLARE
    target_table TEXT;
    has_status BOOLEAN;
    has_is_deleted BOOLEAN;
    has_status_check BOOLEAN;
    inconsistent_rows BIGINT;
BEGIN
    FOREACH target_table IN ARRAY ARRAY['customer', 'product', 'pricehist']
    LOOP
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND information_schema.columns.table_name = target_table
              AND column_name = 'status'
        )
        INTO has_status;

        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND information_schema.columns.table_name = target_table
              AND column_name = 'is_deleted'
        )
        INTO has_is_deleted;

        IF NOT has_status THEN
            IF NOT has_is_deleted THEN
                RAISE EXCEPTION
                    'Cannot add Sprint 2 access to public.%: expected status or legacy is_deleted column.',
                    target_table;
            END IF;

            EXECUTE format(
                'ALTER TABLE public.%I ADD COLUMN status VARCHAR(8) NOT NULL DEFAULT %L',
                target_table,
                'Active'
            );
            EXECUTE format(
                'UPDATE public.%I SET status = %L WHERE is_deleted IS TRUE',
                target_table,
                'Inactive'
            );
        END IF;

        IF has_is_deleted THEN
            EXECUTE format(
                'SELECT COUNT(*) FROM public.%I
                 WHERE status IS NULL
                    OR status NOT IN (%L, %L)
                    OR (status = %L) IS DISTINCT FROM is_deleted',
                target_table,
                'Active',
                'Inactive',
                'Inactive'
            )
            INTO inconsistent_rows;

            IF inconsistent_rows > 0 THEN
                RAISE EXCEPTION
                    'Cannot apply Sprint 2: public.% has % rows with inconsistent status/is_deleted values.',
                    target_table,
                    inconsistent_rows;
            END IF;
        END IF;

        SELECT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = format('public.%I', target_table)::REGCLASS
              AND contype = 'c'
              AND pg_get_constraintdef(oid) ILIKE '%status%'
              AND pg_get_constraintdef(oid) ILIKE '%Active%'
              AND pg_get_constraintdef(oid) ILIKE '%Inactive%'
        )
        INTO has_status_check;

        IF NOT has_status_check THEN
            EXECUTE format(
                'ALTER TABLE public.%I ADD CONSTRAINT %I
                 CHECK (status IN (%L, %L))',
                target_table,
                target_table || '_sprint2_status_check',
                'Active',
                'Inactive'
            );
        END IF;

        EXECUTE format(
            'ALTER TABLE public.%I ALTER COLUMN status SET DEFAULT %L',
            target_table,
            'Active'
        );
        EXECUTE format(
            'ALTER TABLE public.%I ALTER COLUMN status SET NOT NULL',
            target_table
        );
    END LOOP;
END;
$$;

COMMENT ON COLUMN public.customer.status IS
    'Record state; Inactive is a soft delete and is synchronized with legacy is_deleted when present.';
COMMENT ON COLUMN public.product.status IS
    'Record state; Inactive is a soft delete and is synchronized with legacy is_deleted when present.';
COMMENT ON COLUMN public.pricehist.status IS
    'Record state; Inactive is a soft delete and is synchronized with legacy is_deleted when present.';

CREATE FUNCTION public.sync_customer_product_soft_delete_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    old_status TEXT;
    new_status TEXT;
    old_is_deleted BOOLEAN;
    new_is_deleted BOOLEAN;
BEGIN
    IF NOT (to_jsonb(NEW) ? 'is_deleted') THEN
        RETURN NEW;
    END IF;

    new_status := to_jsonb(NEW) ->> 'status';
    new_is_deleted := COALESCE((to_jsonb(NEW) ->> 'is_deleted')::BOOLEAN, FALSE);

    IF new_status IS NOT NULL AND new_status NOT IN ('Active', 'Inactive') THEN
        RAISE EXCEPTION 'Unsupported status value % for public.%.', new_status, TG_TABLE_NAME
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF new_status = 'Inactive' OR new_is_deleted THEN
            NEW := jsonb_populate_record(
                NEW,
                jsonb_build_object('status', 'Inactive', 'is_deleted', TRUE)
            );
        ELSE
            NEW := jsonb_populate_record(
                NEW,
                jsonb_build_object('status', 'Active', 'is_deleted', FALSE)
            );
        END IF;
        RETURN NEW;
    END IF;

    old_status := to_jsonb(OLD) ->> 'status';
    old_is_deleted := COALESCE((to_jsonb(OLD) ->> 'is_deleted')::BOOLEAN, FALSE);

    IF old_status IS DISTINCT FROM new_status
       AND old_is_deleted IS DISTINCT FROM new_is_deleted THEN
        IF (new_status = 'Inactive') IS DISTINCT FROM new_is_deleted THEN
            RAISE EXCEPTION 'Conflicting status and is_deleted values for public.%.', TG_TABLE_NAME
                USING ERRCODE = '23514';
        END IF;
    ELSIF old_status IS DISTINCT FROM new_status THEN
        NEW := jsonb_populate_record(
            NEW,
            jsonb_build_object('is_deleted', new_status = 'Inactive')
        );
    ELSIF old_is_deleted IS DISTINCT FROM new_is_deleted THEN
        NEW := jsonb_populate_record(
            NEW,
            jsonb_build_object(
                'status',
                CASE WHEN new_is_deleted THEN 'Inactive' ELSE 'Active' END
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_customer_product_soft_delete_status() IS
    'Keeps status and legacy is_deleted synchronized without renaming columns referenced by existing objects.';

CREATE TRIGGER a_sprint2_status_sync_customer
    BEFORE INSERT OR UPDATE ON public.customer
    FOR EACH ROW EXECUTE FUNCTION public.sync_customer_product_soft_delete_status();
CREATE TRIGGER a_sprint2_status_sync_product
    BEFORE INSERT OR UPDATE ON public.product
    FOR EACH ROW EXECUTE FUNCTION public.sync_customer_product_soft_delete_status();
CREATE TRIGGER a_sprint2_status_sync_pricehist
    BEFORE INSERT OR UPDATE ON public.pricehist
    FOR EACH ROW EXECUTE FUNCTION public.sync_customer_product_soft_delete_status();

COMMENT ON TRIGGER a_sprint2_status_sync_customer ON public.customer IS
    'Synchronizes customer status with is_deleted when the legacy column exists.';
COMMENT ON TRIGGER a_sprint2_status_sync_product ON public.product IS
    'Synchronizes product status with is_deleted when the legacy column exists.';
COMMENT ON TRIGGER a_sprint2_status_sync_pricehist ON public.pricehist IS
    'Synchronizes price-history status with is_deleted when the legacy column exists.';

ALTER TABLE public.customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricehist ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.current_app_access_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT role.name
    FROM public.app_user AS app_user
    JOIN public.role AS role
      ON role.id = app_user.role_id
     AND role.status = 'Active'
    WHERE app_user.email = lower(btrim(current_setting('app.current_user', TRUE)))
      AND app_user.status = 'Active'
      AND app_user.approval_status = 'approved'
      AND app_user.is_blocked = FALSE
    LIMIT 1;
$$;

COMMENT ON FUNCTION public.current_app_access_role() IS
    'Returns the active, approved, unblocked application role for the trusted transaction-local app.current_user identity.';

CREATE FUNCTION public.current_app_has_right(required_right_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    actor_role TEXT := public.current_app_access_role();
    actor_email TEXT := lower(btrim(current_setting('app.current_user', TRUE)));
BEGIN
    IF required_right_code IS NULL OR required_right_code NOT IN (
        'CUSTOMER_ADD', 'CUSTOMER_EDIT', 'CUSTOMER_DELETE',
        'PRODUCT_ADD', 'PRODUCT_EDIT', 'PRODUCT_DELETE',
        'PRODUCT_PRICE_ADD', 'PRODUCT_PRICE_EDIT', 'PRODUCT_PRICE_DELETE'
    ) THEN
        RETURN FALSE;
    END IF;

    IF actor_role = 'Superadmin' THEN
        RETURN TRUE;
    END IF;

    IF actor_role IS NULL OR actor_role NOT IN ('Admin', 'User') THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.v_user_effective_rights AS effective_right
        WHERE effective_right.email = actor_email
          AND effective_right.right_code = required_right_code
          AND effective_right.granted = TRUE
    );
END;
$$;

COMMENT ON FUNCTION public.current_app_has_right(TEXT) IS
    'Checks a customer/product permission for the trusted transaction-local identity; Superadmin receives the existing implicit grants.';

CREATE POLICY customer_sprint2_select
    ON public.customer
    FOR SELECT
    USING (
        public.current_app_access_role() IN ('Admin', 'Superadmin')
        OR (
            public.current_app_access_role() = 'User'
            AND status = 'Active'
        )
    );

CREATE POLICY customer_sprint2_insert
    ON public.customer
    FOR INSERT
    WITH CHECK (public.current_app_has_right('CUSTOMER_ADD'));

CREATE POLICY customer_sprint2_update
    ON public.customer
    FOR UPDATE
    USING (
        public.current_app_has_right('CUSTOMER_EDIT')
        OR public.current_app_has_right('CUSTOMER_DELETE')
    )
    WITH CHECK (
        public.current_app_has_right('CUSTOMER_EDIT')
        OR public.current_app_has_right('CUSTOMER_DELETE')
    );

CREATE POLICY product_sprint2_select
    ON public.product
    FOR SELECT
    USING (
        public.current_app_access_role() IN ('Admin', 'Superadmin')
        OR (
            public.current_app_access_role() = 'User'
            AND status = 'Active'
        )
    );

CREATE POLICY product_sprint2_insert
    ON public.product
    FOR INSERT
    WITH CHECK (public.current_app_has_right('PRODUCT_ADD'));

CREATE POLICY product_sprint2_update
    ON public.product
    FOR UPDATE
    USING (
        public.current_app_has_right('PRODUCT_EDIT')
        OR public.current_app_has_right('PRODUCT_DELETE')
    )
    WITH CHECK (
        public.current_app_has_right('PRODUCT_EDIT')
        OR public.current_app_has_right('PRODUCT_DELETE')
    );

CREATE POLICY pricehist_sprint2_select
    ON public.pricehist
    FOR SELECT
    USING (
        public.current_app_access_role() IN ('Admin', 'Superadmin')
        OR (
            public.current_app_access_role() = 'User'
            AND status = 'Active'
        )
    );

CREATE POLICY pricehist_sprint2_insert
    ON public.pricehist
    FOR INSERT
    WITH CHECK (public.current_app_has_right('PRODUCT_PRICE_ADD'));

CREATE POLICY pricehist_sprint2_update
    ON public.pricehist
    FOR UPDATE
    USING (
        public.current_app_has_right('PRODUCT_PRICE_EDIT')
        OR public.current_app_has_right('PRODUCT_PRICE_DELETE')
    )
    WITH CHECK (
        public.current_app_has_right('PRODUCT_PRICE_EDIT')
        OR public.current_app_has_right('PRODUCT_PRICE_DELETE')
    );

COMMENT ON POLICY customer_sprint2_select ON public.customer IS
    'Admins and Superadmins see all customers; Users see only Active customers.';
COMMENT ON POLICY customer_sprint2_insert ON public.customer IS
    'Requires the effective CUSTOMER_ADD right.';
COMMENT ON POLICY customer_sprint2_update ON public.customer IS
    'Requires the effective CUSTOMER_EDIT or CUSTOMER_DELETE right; the trigger checks which action is being performed.';
COMMENT ON POLICY product_sprint2_select ON public.product IS
    'Admins and Superadmins see all products; Users see only Active products.';
COMMENT ON POLICY product_sprint2_insert ON public.product IS
    'Requires the effective PRODUCT_ADD right.';
COMMENT ON POLICY product_sprint2_update ON public.product IS
    'Requires the effective PRODUCT_EDIT or PRODUCT_DELETE right; the trigger checks which action is being performed.';
COMMENT ON POLICY pricehist_sprint2_select ON public.pricehist IS
    'Admins and Superadmins see all price history; Users see only Active price-history rows.';
COMMENT ON POLICY pricehist_sprint2_insert ON public.pricehist IS
    'Requires the effective PRODUCT_PRICE_ADD right.';
COMMENT ON POLICY pricehist_sprint2_update ON public.pricehist IS
    'Requires the effective PRODUCT_PRICE_EDIT or PRODUCT_PRICE_DELETE right; the trigger checks which action is being performed.';

CREATE FUNCTION public.guard_customer_product_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    add_right TEXT;
    edit_right TEXT;
    delete_right TEXT;
    data_changed BOOLEAN;
BEGIN
    CASE TG_TABLE_NAME
        WHEN 'customer' THEN
            add_right := 'CUSTOMER_ADD';
            edit_right := 'CUSTOMER_EDIT';
            delete_right := 'CUSTOMER_DELETE';
        WHEN 'product' THEN
            add_right := 'PRODUCT_ADD';
            edit_right := 'PRODUCT_EDIT';
            delete_right := 'PRODUCT_DELETE';
        WHEN 'pricehist' THEN
            add_right := 'PRODUCT_PRICE_ADD';
            edit_right := 'PRODUCT_PRICE_EDIT';
            delete_right := 'PRODUCT_PRICE_DELETE';
        ELSE
            RAISE EXCEPTION 'Unsupported table for customer/product write guard: %', TG_TABLE_NAME
                USING ERRCODE = '22023';
    END CASE;

    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'Active' THEN
            RAISE EXCEPTION 'New customer, product, and price-history rows must start Active.'
                USING ERRCODE = '23514';
        END IF;

        IF NOT public.current_app_has_right(add_right) THEN
            RAISE EXCEPTION 'The current application user lacks permission %.', add_right
                USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    data_changed :=
        (to_jsonb(NEW) - ARRAY['status', 'stamp', 'is_deleted'])
        IS DISTINCT FROM
        (to_jsonb(OLD) - ARRAY['status', 'stamp', 'is_deleted']);

    IF OLD.status IS DISTINCT FROM NEW.status THEN
        IF OLD.status = 'Active' AND NEW.status = 'Inactive' THEN
            IF NOT public.current_app_has_right(delete_right) THEN
                RAISE EXCEPTION 'The current application user lacks permission %.', delete_right
                    USING ERRCODE = '42501';
            END IF;
        ELSIF OLD.status = 'Inactive' AND NEW.status = 'Active' THEN
            IF NOT public.current_app_has_right(edit_right) THEN
                RAISE EXCEPTION 'The current application user lacks permission % to restore the row.', edit_right
                    USING ERRCODE = '42501';
            END IF;
        ELSE
            RAISE EXCEPTION 'Unsupported status transition from % to %.', OLD.status, NEW.status
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF data_changed AND NOT public.current_app_has_right(edit_right) THEN
        RAISE EXCEPTION 'The current application user lacks permission %.', edit_right
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_customer_product_write() IS
    'Enforces module add/edit/delete rights, requires new rows to start Active, and permits soft deletion only through status.';

CREATE TRIGGER customer_sprint2_write_guard
    BEFORE INSERT OR UPDATE ON public.customer
    FOR EACH ROW EXECUTE FUNCTION public.guard_customer_product_write();
CREATE TRIGGER product_sprint2_write_guard
    BEFORE INSERT OR UPDATE ON public.product
    FOR EACH ROW EXECUTE FUNCTION public.guard_customer_product_write();
CREATE TRIGGER pricehist_sprint2_write_guard
    BEFORE INSERT OR UPDATE ON public.pricehist
    FOR EACH ROW EXECUTE FUNCTION public.guard_customer_product_write();

COMMENT ON TRIGGER customer_sprint2_write_guard ON public.customer IS
    'Enforces customer rights and directs soft deletion through status = Inactive.';
COMMENT ON TRIGGER product_sprint2_write_guard ON public.product IS
    'Enforces product rights and directs soft deletion through status = Inactive.';
COMMENT ON TRIGGER pricehist_sprint2_write_guard ON public.pricehist IS
    'Enforces price-history rights and directs soft deletion through status = Inactive.';

CREATE FUNCTION public.reject_customer_product_physical_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    RAISE EXCEPTION 'Physical deletion is forbidden for customer, product, and price-history rows; set status to Inactive.'
        USING ERRCODE = '42501';
END;
$$;

COMMENT ON FUNCTION public.reject_customer_product_physical_delete() IS
    'Blocks DELETE and TRUNCATE so customer, product, and price-history records are only soft-deleted.';

CREATE TRIGGER a_sprint2_no_physical_delete_customer
    BEFORE DELETE OR TRUNCATE ON public.customer
    FOR EACH STATEMENT EXECUTE FUNCTION public.reject_customer_product_physical_delete();
CREATE TRIGGER a_sprint2_no_physical_delete_product
    BEFORE DELETE OR TRUNCATE ON public.product
    FOR EACH STATEMENT EXECUTE FUNCTION public.reject_customer_product_physical_delete();
CREATE TRIGGER a_sprint2_no_physical_delete_pricehist
    BEFORE DELETE OR TRUNCATE ON public.pricehist
    FOR EACH STATEMENT EXECUTE FUNCTION public.reject_customer_product_physical_delete();

COMMENT ON TRIGGER a_sprint2_no_physical_delete_customer ON public.customer IS
    'Rejects physical DELETE and TRUNCATE; use the audited status transition instead.';
COMMENT ON TRIGGER a_sprint2_no_physical_delete_product ON public.product IS
    'Rejects physical DELETE and TRUNCATE; use the audited status transition instead.';
COMMENT ON TRIGGER a_sprint2_no_physical_delete_pricehist ON public.pricehist IS
    'Rejects physical DELETE and TRUNCATE; use the audited status transition instead.';

DO $$
DECLARE
    application_role TEXT;
    product_code_column TEXT;
    pricehist_code_column TEXT;
    pricehist_date_column TEXT;
    pricehist_amount_column TEXT;
BEGIN
    SELECT column_name
      INTO product_code_column
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'product'
       AND column_name IN ('prod_code', 'prodcode')
     ORDER BY CASE column_name WHEN 'prod_code' THEN 1 ELSE 2 END
     LIMIT 1;

    SELECT column_name
      INTO pricehist_code_column
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'pricehist'
       AND column_name IN ('prod_code', 'prodcode')
     ORDER BY CASE column_name WHEN 'prod_code' THEN 1 ELSE 2 END
     LIMIT 1;

    SELECT column_name
      INTO pricehist_date_column
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'pricehist'
       AND column_name IN ('eff_date', 'effdate')
     ORDER BY CASE column_name WHEN 'eff_date' THEN 1 ELSE 2 END
     LIMIT 1;

    SELECT column_name
      INTO pricehist_amount_column
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'pricehist'
       AND column_name IN ('unit_price', 'unitprice')
     ORDER BY CASE column_name WHEN 'unit_price' THEN 1 ELSE 2 END
     LIMIT 1;

    IF product_code_column IS NULL
       OR pricehist_code_column IS NULL
       OR pricehist_date_column IS NULL
       OR pricehist_amount_column IS NULL THEN
        RAISE EXCEPTION
            'Cannot create Sprint 2 product views: required canonical or legacy product/price-history columns are missing.';
    END IF;

    EXECUTE $view$
        CREATE VIEW public.v_customer_admin
        WITH (security_barrier = TRUE)
        AS
        SELECT cust_no, cust_name, address, pay_terms, status, stamp
        FROM public.customer
        WHERE public.current_app_access_role() IN ('Admin', 'Superadmin')
    $view$;

    EXECUTE $view$
        CREATE VIEW public.v_customer_user
        WITH (security_barrier = TRUE)
        AS
        SELECT cust_no, cust_name, address, pay_terms
        FROM public.customer
        WHERE public.current_app_access_role() = 'User'
          AND status = 'Active'
    $view$;

    EXECUTE format($view$
        CREATE VIEW public.v_product_admin
        WITH (security_barrier = TRUE)
        AS
        SELECT product.%1$I AS prod_code,
               product.description,
               product.unit,
               current_price.unit_price AS current_price,
               product.status,
               product.stamp
        FROM public.product AS product
        LEFT JOIN LATERAL (
            SELECT pricehist.%4$I AS unit_price
            FROM public.pricehist AS pricehist
            WHERE pricehist.%2$I = product.%1$I
              AND pricehist.%3$I <= CURRENT_DATE
              AND pricehist.status = 'Active'
            ORDER BY pricehist.%3$I DESC
            LIMIT 1
        ) AS current_price ON TRUE
        WHERE public.current_app_access_role() IN ('Admin', 'Superadmin')
    $view$, product_code_column, pricehist_code_column,
           pricehist_date_column, pricehist_amount_column);

    EXECUTE format($view$
        CREATE VIEW public.v_product_user
        WITH (security_barrier = TRUE)
        AS
        SELECT product.%1$I AS prod_code,
               product.description,
               product.unit,
               current_price.unit_price AS current_price
        FROM public.product AS product
        LEFT JOIN LATERAL (
            SELECT pricehist.%4$I AS unit_price
            FROM public.pricehist AS pricehist
            WHERE pricehist.%2$I = product.%1$I
              AND pricehist.%3$I <= CURRENT_DATE
              AND pricehist.status = 'Active'
            ORDER BY pricehist.%3$I DESC
            LIMIT 1
        ) AS current_price ON TRUE
        WHERE public.current_app_access_role() = 'User'
          AND product.status = 'Active'
    $view$, product_code_column, pricehist_code_column,
           pricehist_date_column, pricehist_amount_column);

    EXECUTE format($view$
        CREATE VIEW public.v_pricehist_admin
        WITH (security_barrier = TRUE)
        AS
        SELECT %1$I AS prod_code, %2$I AS eff_date, %3$I AS unit_price, status, stamp
        FROM public.pricehist
        WHERE public.current_app_access_role() IN ('Admin', 'Superadmin')
    $view$, pricehist_code_column, pricehist_date_column, pricehist_amount_column);

    EXECUTE format($view$
        CREATE VIEW public.v_pricehist_user
        WITH (security_barrier = TRUE)
        AS
        SELECT %1$I AS prod_code, %2$I AS eff_date, %3$I AS unit_price
        FROM public.pricehist
        WHERE public.current_app_access_role() = 'User'
          AND status = 'Active'
    $view$, pricehist_code_column, pricehist_date_column, pricehist_amount_column);
END;
$$;

COMMENT ON VIEW public.v_customer_admin IS
    'All customer rows, including Status and Stamp; returns rows only for Admin and Superadmin contexts.';
COMMENT ON VIEW public.v_customer_user IS
    'Active customers for User contexts; intentionally excludes Status and Stamp columns.';
COMMENT ON VIEW public.v_product_admin IS
    'All products, including Status and Stamp, with current price derived from effective active PRICEHIST rows.';
COMMENT ON VIEW public.v_product_user IS
    'Active products for User contexts without Status or Stamp; current price is derived from PRICEHIST.';
COMMENT ON VIEW public.v_pricehist_admin IS
    'All price-history rows, including Status and Stamp, for Admin and Superadmin contexts.';
COMMENT ON VIEW public.v_pricehist_user IS
    'Active price-history rows for User contexts; intentionally excludes Status and Stamp columns.';
COMMENT ON COLUMN public.v_product_admin.current_price IS
    'Derived at query time from the latest Active PRICEHIST row effective on or before CURRENT_DATE.';
COMMENT ON COLUMN public.v_product_user.current_price IS
    'Derived at query time from the latest Active PRICEHIST row effective on or before CURRENT_DATE.';

REVOKE ALL ON TABLE public.customer, public.product, public.pricehist FROM PUBLIC;
REVOKE SELECT (status, stamp) ON TABLE public.customer, public.product, public.pricehist FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_app_access_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_app_has_right(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_customer_product_soft_delete_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_customer_product_write() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_customer_product_physical_delete() FROM PUBLIC;

DO $$
DECLARE
    application_role TEXT;
    product_code_column TEXT;
    pricehist_code_column TEXT;
    pricehist_date_column TEXT;
    pricehist_amount_column TEXT;
BEGIN
    SELECT column_name
      INTO product_code_column
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'product'
       AND column_name IN ('prod_code', 'prodcode')
     ORDER BY CASE column_name WHEN 'prod_code' THEN 1 ELSE 2 END
     LIMIT 1;

    SELECT column_name
      INTO pricehist_code_column
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'pricehist'
       AND column_name IN ('prod_code', 'prodcode')
     ORDER BY CASE column_name WHEN 'prod_code' THEN 1 ELSE 2 END
     LIMIT 1;

    SELECT column_name
      INTO pricehist_date_column
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'pricehist'
       AND column_name IN ('eff_date', 'effdate')
     ORDER BY CASE column_name WHEN 'eff_date' THEN 1 ELSE 2 END
     LIMIT 1;

    SELECT column_name
      INTO pricehist_amount_column
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'pricehist'
       AND column_name IN ('unit_price', 'unitprice')
     ORDER BY CASE column_name WHEN 'unit_price' THEN 1 ELSE 2 END
     LIMIT 1;

    FOREACH application_role IN ARRAY ARRAY['hope_app', 'authenticated']
    LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = application_role) THEN
        EXECUTE format(
            'REVOKE ALL ON TABLE public.customer, public.product, public.pricehist FROM %I',
            application_role
        );
        EXECUTE format(
            'REVOKE SELECT (status, stamp) ON TABLE public.customer, public.product, public.pricehist FROM %I',
            application_role
        );
        EXECUTE format(
            'GRANT SELECT (cust_no, cust_name, address, pay_terms) ON TABLE public.customer TO %I',
            application_role
        );
        EXECUTE format(
            'GRANT SELECT (%I, description, unit) ON TABLE public.product TO %I',
            product_code_column, application_role
        );
        EXECUTE format(
            'GRANT SELECT (%I, %I, %I) ON TABLE public.pricehist TO %I',
            pricehist_code_column, pricehist_date_column,
            pricehist_amount_column, application_role
        );

        EXECUTE format(
            'GRANT INSERT (cust_no, cust_name, address, pay_terms) ON TABLE public.customer TO %I',
            application_role
        );
        EXECUTE format(
            'GRANT UPDATE (cust_name, address, pay_terms, status) ON TABLE public.customer TO %I',
            application_role
        );
        EXECUTE format(
            'GRANT INSERT (%I, description, unit) ON TABLE public.product TO %I',
            product_code_column, application_role
        );
        EXECUTE format(
            'GRANT UPDATE (description, unit, status) ON TABLE public.product TO %I',
            application_role
        );
        EXECUTE format(
            'GRANT INSERT (%I, %I, %I) ON TABLE public.pricehist TO %I',
            pricehist_code_column, pricehist_date_column,
            pricehist_amount_column, application_role
        );
        EXECUTE format(
            'GRANT UPDATE (%I, status) ON TABLE public.pricehist TO %I',
            pricehist_amount_column, application_role
        );

        EXECUTE format(
            'GRANT SELECT ON TABLE public.v_customer_admin, public.v_customer_user,
             public.v_product_admin, public.v_product_user,
             public.v_pricehist_admin, public.v_pricehist_user TO %I',
            application_role
        );
        EXECUTE format(
            'GRANT EXECUTE ON FUNCTION public.current_app_access_role() TO %I',
            application_role
        );
        EXECUTE format(
            'GRANT EXECUTE ON FUNCTION public.current_app_has_right(TEXT) TO %I',
            application_role
        );
      END IF;
    END LOOP;
END;
$$;

COMMENT ON TABLE public.customer IS
    'Customer master. Use status = Inactive for soft deletion; use the role-filtered Sprint 2 views for reads.';
COMMENT ON TABLE public.product IS
    'Product master. Current price is derived from PRICEHIST and is not stored on this table.';
COMMENT ON TABLE public.pricehist IS
    'Effective-dated product prices. Use status = Inactive for soft deletion; current price is the latest active effective price.';
