\set ON_ERROR_STOP on
-- Run after migrations 001-007 and seed 001. All write fixtures are rolled back.
BEGIN;

CREATE FUNCTION pg_temp.sprint2_assert(
    test_name TEXT,
    test_passed BOOLEAN,
    details TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF test_passed IS DISTINCT FROM TRUE THEN
        RAISE NOTICE 'FAIL: % - %', test_name, COALESCE(details, '');
        RAISE EXCEPTION 'Sprint 2 verification failed: %', test_name;
    END IF;
    RAISE NOTICE 'PASS: %', test_name;
END;
$$;

CREATE TEMP VIEW sprint2_sales_normalized AS
SELECT COALESCE(
           to_jsonb(sales) ->> 'trans_no',
           to_jsonb(sales) ->> 'transno'
       ) AS trans_no,
       COALESCE(
           to_jsonb(sales) ->> 'sales_date',
           to_jsonb(sales) ->> 'salesdate'
       )::DATE AS sales_date,
       COALESCE(
           to_jsonb(sales) ->> 'status',
           CASE
               WHEN COALESCE((to_jsonb(sales) ->> 'is_deleted')::BOOLEAN, FALSE)
                   THEN 'Inactive'
               ELSE 'Active'
           END
       ) AS status
FROM public.sales AS sales;

CREATE TEMP VIEW sprint2_salesdetail_normalized AS
SELECT COALESCE(
           to_jsonb(salesdetail) ->> 'trans_no',
           to_jsonb(salesdetail) ->> 'transno'
       ) AS trans_no,
       COALESCE(
           to_jsonb(salesdetail) ->> 'prod_code',
           to_jsonb(salesdetail) ->> 'prodcode'
       ) AS prod_code,
       salesdetail.quantity,
       COALESCE(
           to_jsonb(salesdetail) ->> 'status',
           CASE
               WHEN COALESCE((to_jsonb(salesdetail) ->> 'is_deleted')::BOOLEAN, FALSE)
                   THEN 'Inactive'
               ELSE 'Active'
           END
       ) AS status
FROM public.salesdetail AS salesdetail;

DO $$
DECLARE
    admin_email TEXT;
    admin_id BIGINT;
    user_email TEXT;
    user_id BIGINT;
    user_role_id BIGINT;
    candidate_user_email TEXT;
    customer_add_right_id BIGINT;
    fixture_customer TEXT := 'S2-' || upper(substr(md5(random()::TEXT), 1, 6));
    fixture_product TEXT := 'S2-' || upper(substr(md5(random()::TEXT), 1, 6));
    product_code_column TEXT;
    actual_stamp TEXT;
    actual_status TEXT;
    legacy_is_deleted BOOLEAN;
    has_legacy_is_deleted BOOLEAN;
    audit_action TEXT;
    blocked BOOLEAN := FALSE;
    total_value NUMERIC(12, 2);
    matching_totals INTEGER;
BEGIN
    SELECT app_user.email, app_user.id
      INTO admin_email, admin_id
      FROM public.app_user AS app_user
      JOIN public.role AS role ON role.id = app_user.role_id
     WHERE role.name = 'Superadmin'
       AND role.status = 'Active'
       AND app_user.status = 'Active'
       AND app_user.approval_status = 'approved'
       AND app_user.is_blocked = FALSE
     ORDER BY app_user.id
     LIMIT 1;

    SELECT app_user.email, app_user.id
      INTO user_email, user_id
      FROM public.app_user AS app_user
      JOIN public.role AS role ON role.id = app_user.role_id
     WHERE role.name = 'User'
       AND role.status = 'Active'
       AND app_user.status = 'Active'
       AND app_user.approval_status = 'approved'
       AND app_user.is_blocked = FALSE
     ORDER BY app_user.id
     LIMIT 1;

    IF user_id IS NULL THEN
        SELECT role.id
          INTO user_role_id
          FROM public.role AS role
         WHERE role.name = 'User'
           AND role.status = 'Active';

        SELECT app_user.email, app_user.id
          INTO candidate_user_email, user_id
          FROM public.app_user AS app_user
          JOIN public.role AS role ON role.id = app_user.role_id
         WHERE role.name = 'Superadmin'
           AND role.status = 'Active'
           AND app_user.status = 'Active'
           AND app_user.approval_status = 'approved'
           AND app_user.is_blocked = FALSE
           AND app_user.id <> admin_id
         ORDER BY app_user.id
         LIMIT 1;

        IF user_role_id IS NOT NULL AND user_id IS NOT NULL THEN
            UPDATE public.app_user
               SET role_id = user_role_id
             WHERE id = user_id;
            user_email := candidate_user_email;
        END IF;
    END IF;

    PERFORM pg_temp.sprint2_assert(
        'active approved Superadmin and User test identities exist',
        admin_email IS NOT NULL AND user_email IS NOT NULL,
        'Use an active approved Superadmin and an active User, or two active approved Superadmins for the rollback-only User fixture.'
    );

    PERFORM pg_temp.sprint2_assert(
        'User-facing views omit Status and Stamp columns',
        NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name IN ('v_customer_user', 'v_product_user', 'v_pricehist_user')
              AND lower(column_name) IN ('status', 'stamp')
        ),
        'A user view exposed a restricted column.'
    );

    PERFORM pg_temp.sprint2_assert(
        'Admin-facing views include Status and Stamp columns',
        (
            SELECT COUNT(*) = 6
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name IN ('v_customer_admin', 'v_product_admin', 'v_pricehist_admin')
              AND lower(column_name) IN ('status', 'stamp')
        ),
        'Admin views must expose both status and stamp for all three entities.'
    );

    PERFORM pg_temp.sprint2_assert(
        'RLS is enabled and customer/product/price-history policies are installed',
        (
            SELECT COUNT(*) = 3
            FROM pg_class AS relation
            JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
            WHERE namespace.nspname = 'public'
              AND relation.relname IN ('customer', 'product', 'pricehist')
              AND relation.relrowsecurity
        )
        AND (
            SELECT COUNT(DISTINCT tablename) = 3
            FROM pg_policies
            WHERE schemaname = 'public'
              AND policyname IN (
                  'customer_sprint2_select', 'product_sprint2_select',
                  'pricehist_sprint2_select'
              )
        ),
        'Expected row-level security and role-filtering policies on all three base tables.'
    );

    PERFORM pg_temp.sprint2_assert(
        'application roles cannot select Status or Stamp from base tables',
        NOT EXISTS (
            SELECT 1
            FROM pg_roles AS application_role
            WHERE application_role.rolname IN ('hope_app', 'authenticated')
              AND (
                  has_column_privilege(application_role.rolname, 'public.customer', 'status', 'SELECT')
                  OR has_column_privilege(application_role.rolname, 'public.customer', 'stamp', 'SELECT')
                  OR has_column_privilege(application_role.rolname, 'public.product', 'status', 'SELECT')
                  OR has_column_privilege(application_role.rolname, 'public.product', 'stamp', 'SELECT')
                  OR has_column_privilege(application_role.rolname, 'public.pricehist', 'status', 'SELECT')
                  OR has_column_privilege(application_role.rolname, 'public.pricehist', 'stamp', 'SELECT')
              )
        ),
        'Revoke prior table-level or inherited grants before granting User-safe base columns.'
    );

    PERFORM set_config('app.current_user', admin_email, TRUE);
    SELECT column_name
      INTO product_code_column
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'product'
       AND column_name IN ('prod_code', 'prodcode')
     ORDER BY CASE column_name WHEN 'prod_code' THEN 1 ELSE 2 END
     LIMIT 1;

    EXECUTE format(
        'INSERT INTO public.product (%I, description, unit, status, stamp)
         VALUES ($1, $2, $3, $4, $5)',
        product_code_column
    )
    USING fixture_product, 'Sprint 2 rollback fixture', 'pcs', 'Active', 'test';

    EXECUTE format(
        'UPDATE public.product SET status = $2 WHERE %I = $1',
        product_code_column
    )
    USING fixture_product, 'Inactive';

    EXECUTE format(
        'SELECT status,
                to_jsonb(product) ? %L,
                COALESCE((to_jsonb(product) ->> %L)::BOOLEAN, FALSE)
           FROM public.product AS product
          WHERE %I = $1',
        'is_deleted', 'is_deleted', product_code_column
    )
    INTO actual_status, has_legacy_is_deleted, legacy_is_deleted
    USING fixture_product;

    PERFORM pg_temp.sprint2_assert(
        'product soft delete synchronizes legacy is_deleted when present',
        actual_status = 'Inactive'
        AND (NOT has_legacy_is_deleted OR legacy_is_deleted)
        AND EXISTS (
            SELECT 1
            FROM public.v_product_admin
            WHERE prod_code = fixture_product
              AND status = 'Inactive'
        ),
        'Expected status = Inactive and a synchronized legacy is_deleted value.'
    );

    PERFORM pg_temp.sprint2_assert(
        'Admin view returns all five guide customers including inactive C-004',
        (
            SELECT COUNT(*) = 5
               AND bool_or(cust_no = 'C-004' AND status = 'Inactive')
            FROM public.v_customer_admin
            WHERE cust_no BETWEEN 'C-001' AND 'C-005'
        ),
        'Expected C-001 through C-005 with C-004 inactive.'
    );
    PERFORM pg_temp.sprint2_assert(
        'Admin view returns all five guide products including inactive P-004',
        (
            SELECT COUNT(*) = 5
               AND bool_or(prod_code = 'P-004' AND status = 'Inactive')
            FROM public.v_product_admin
            WHERE prod_code BETWEEN 'P-001' AND 'P-005'
        ),
        'Expected P-001 through P-005 with P-004 inactive.'
    );

    PERFORM set_config('app.current_user', user_email, TRUE);
    PERFORM pg_temp.sprint2_assert(
        'User views return only Active guide customers',
        (
            SELECT COUNT(*) = 4
               AND bool_and(status = 'Active')
            FROM public.customer
            WHERE cust_no BETWEEN 'C-001' AND 'C-005'
              AND cust_no IN (SELECT cust_no FROM public.v_customer_user)
        )
        AND NOT EXISTS (
            SELECT 1 FROM public.v_customer_user WHERE cust_no = 'C-004'
        ),
        'Expected four active guide customers and no C-004.'
    );
    PERFORM pg_temp.sprint2_assert(
        'User views return only Active guide products',
        (
            SELECT COUNT(*) = 4
            FROM public.v_product_user
            WHERE prod_code BETWEEN 'P-001' AND 'P-005'
        )
        AND NOT EXISTS (
            SELECT 1 FROM public.v_product_user WHERE prod_code = 'P-004'
        ),
        'Expected four active guide products and no P-004.'
    );

    PERFORM set_config('app.current_user', admin_email, TRUE);
    PERFORM pg_temp.sprint2_assert(
        'P-003 current price is derived as 28.00 and P-004 has no current price',
        (
            SELECT current_price = 28.00
            FROM public.v_product_admin
            WHERE prod_code = 'P-003'
        )
        AND (
            SELECT current_price IS NULL
            FROM public.v_product_admin
            WHERE prod_code = 'P-004'
        ),
        'Expected P-003 = 28.00 and P-004 = NULL as of CURRENT_DATE.'
    );

    WITH expected (trans_no, amount) AS (
        VALUES
            ('T-001', 234.50::NUMERIC(12, 2)),
            ('T-002', 140.00::NUMERIC(12, 2)),
            ('T-003', 510.00::NUMERIC(12, 2))
    ),
    actual AS (
        SELECT sales.trans_no,
               SUM(salesdetail.quantity * current_price.unit_price)::NUMERIC(12, 2) AS amount
        FROM sprint2_sales_normalized AS sales
        JOIN sprint2_salesdetail_normalized AS salesdetail
          ON salesdetail.trans_no = sales.trans_no
         AND salesdetail.status = 'Active'
        JOIN LATERAL (
            SELECT pricehist.unit_price
            FROM public.v_pricehist_admin AS pricehist
            WHERE pricehist.prod_code = salesdetail.prod_code
              AND pricehist.eff_date <= sales.sales_date
              AND pricehist.status = 'Active'
            ORDER BY pricehist.eff_date DESC
            LIMIT 1
        ) AS current_price ON TRUE
        WHERE sales.status = 'Active'
          AND sales.trans_no IN ('T-001', 'T-002', 'T-003')
        GROUP BY sales.trans_no
    )
    SELECT COUNT(*) FILTER (WHERE actual.amount = expected.amount),
           COALESCE(SUM(actual.amount) FILTER (WHERE actual.amount = expected.amount), 0)
             ::NUMERIC(12, 2)
      INTO matching_totals, total_value
      FROM expected
      LEFT JOIN actual USING (trans_no);

    PERFORM pg_temp.sprint2_assert(
        'T-001, T-002, and T-003 totals remain 234.50, 140.00, and 510.00',
        matching_totals = 3 AND total_value = 884.50,
        format('Expected all three totals; matched %s and summed %s.', matching_totals, total_value)
    );

    WITH active_sales_total AS (
        SELECT sales.trans_no,
               SUM(salesdetail.quantity * current_price.unit_price) AS amount
        FROM sprint2_sales_normalized AS sales
        JOIN sprint2_salesdetail_normalized AS salesdetail
          ON salesdetail.trans_no = sales.trans_no
         AND salesdetail.status = 'Active'
        JOIN LATERAL (
            SELECT pricehist.unit_price
            FROM public.v_pricehist_admin AS pricehist
            WHERE pricehist.prod_code = salesdetail.prod_code
              AND pricehist.eff_date <= sales.sales_date
              AND pricehist.status = 'Active'
            ORDER BY pricehist.eff_date DESC
            LIMIT 1
        ) AS current_price ON TRUE
        WHERE sales.status = 'Active'
        GROUP BY sales.trans_no
    )
    SELECT COALESCE(SUM(amount), 0)::NUMERIC(12, 2)
      INTO total_value
      FROM active_sales_total;

    PERFORM pg_temp.sprint2_assert(
        'sum of Active sales remains 884.50',
        total_value = 884.50,
        format('Expected 884.50; received %s.', total_value)
    );

    SELECT rights.id
      INTO customer_add_right_id
      FROM public.rights AS rights
     WHERE rights.code = 'CUSTOMER_ADD'
       AND rights.status = 'Active';

    PERFORM pg_temp.sprint2_assert(
        'active CUSTOMER_ADD right exists for the blocked-user guard test',
        customer_add_right_id IS NOT NULL,
        'Apply the Task 5 rights catalogue seed before verification.'
    );

    PERFORM set_config('app.current_user', admin_email, TRUE);
    INSERT INTO public.user_permission (
        user_id, right_id, granted_by, granted_at, status, stamp
    )
    VALUES (
        user_id, customer_add_right_id, admin_id, CURRENT_TIMESTAMP, 'Active', 'test'
    )
    ON CONFLICT (user_id, right_id) DO UPDATE
       SET granted_by = EXCLUDED.granted_by,
           granted_at = EXCLUDED.granted_at,
           status = 'Active',
           stamp = EXCLUDED.stamp;

    PERFORM set_config('app.current_user', user_email, TRUE);
    UPDATE public.app_user
       SET is_blocked = TRUE
     WHERE id = user_id;
    PERFORM pg_temp.sprint2_assert(
        'blocked users cannot retain customer/product write authorization',
        public.current_app_access_role() IS NULL
        AND NOT public.current_app_has_right('CUSTOMER_ADD'),
        'A blocked user with an active CUSTOMER_ADD grant was still authorized.'
    );

    PERFORM set_config('app.current_user', admin_email, TRUE);
    INSERT INTO public.customer (cust_no, cust_name, address, pay_terms, status, stamp)
    VALUES (fixture_customer, 'Sprint 2 rollback fixture', 'Test only', 'COD', 'Active', 'test');
    UPDATE public.customer
       SET status = 'Inactive'
     WHERE cust_no = fixture_customer;

    SELECT stamp
      INTO actual_stamp
      FROM public.customer
     WHERE cust_no = fixture_customer;
    SELECT action
      INTO audit_action
      FROM public.audit_log
     WHERE table_name = 'customer'
       AND record_key = jsonb_build_object('cust_no', fixture_customer)::TEXT
     ORDER BY id DESC
     LIMIT 1;

    PERFORM pg_temp.sprint2_assert(
        'soft delete sets Inactive and records DELETED audit action',
        actual_stamp LIKE 'DELETED %' AND audit_action = 'DELETED',
        'Expected an audited Active-to-Inactive transition.'
    );

    BEGIN
        DELETE FROM public.customer WHERE cust_no = fixture_customer;
    EXCEPTION WHEN insufficient_privilege THEN
        blocked := TRUE;
    END;
    PERFORM pg_temp.sprint2_assert(
        'physical DELETE is rejected',
        blocked,
        'The DELETE trigger did not reject a physical deletion.'
    );

    blocked := FALSE;
    BEGIN
        TRUNCATE TABLE public.customer;
    EXCEPTION WHEN insufficient_privilege THEN
        blocked := TRUE;
    END;
    PERFORM pg_temp.sprint2_assert(
        'TRUNCATE is rejected',
        blocked,
        'The TRUNCATE trigger did not reject a physical deletion.'
    );
END;
$$;

ROLLBACK;
