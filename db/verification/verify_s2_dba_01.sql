\set ON_ERROR_STOP on
-- Run after migrations 001-008 and seed 001.
-- All role-setting work is transaction-local. No rows are changed.
BEGIN;

CREATE FUNCTION pg_temp.s2_dba_assert(
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
        RAISE EXCEPTION 'S2-DBA-01 verification failed: %', test_name;
    END IF;
    RAISE NOTICE 'PASS: %', test_name;
END;
$$;

DO $$
DECLARE
    admin_email TEXT;
    user_email TEXT;
    customer_active_count BIGINT;
    customer_all_count BIGINT;
    product_active_count BIGINT;
    product_all_count BIGINT;
    status_column_count INTEGER;
BEGIN
    SELECT app_user.email
      INTO admin_email
      FROM public.app_user AS app_user
      JOIN public.role AS role ON role.id = app_user.role_id
     WHERE role.name = 'Superadmin'
       AND app_user.status = 'Active'
       AND app_user.approval_status = 'approved'
       AND app_user.is_blocked = FALSE
     ORDER BY app_user.id
     LIMIT 1;

    SELECT app_user.email
      INTO user_email
      FROM public.app_user AS app_user
      JOIN public.role AS role ON role.id = app_user.role_id
     WHERE role.name = 'User'
       AND app_user.status = 'Active'
       AND app_user.approval_status = 'approved'
       AND app_user.is_blocked = FALSE
     ORDER BY app_user.id
     LIMIT 1;

    PERFORM pg_temp.s2_dba_assert(
        'verification identities exist',
        admin_email IS NOT NULL AND user_email IS NOT NULL,
        'Seed an active approved Superadmin and User.'
    );

    PERFORM pg_temp.s2_dba_assert(
        'User view projections omit Status and Stamp',
        NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name IN ('v_customer_active', 'v_product_active')
              AND lower(column_name) IN ('status', 'stamp')
        ),
        'A User view exposed Status or Stamp.'
    );

    PERFORM set_config('app.current_user', user_email, TRUE);

    SELECT count(*)
      INTO customer_active_count
      FROM public.v_customer_active
     WHERE cust_no BETWEEN 'C-001' AND 'C-005';

    SELECT count(*)
      INTO product_active_count
      FROM public.v_product_active
     WHERE prod_code BETWEEN 'P-001' AND 'P-005';

    PERFORM pg_temp.s2_dba_assert(
        'Customer User view count is 4 and excludes C-004',
        customer_active_count = 4
        AND NOT EXISTS (
            SELECT 1 FROM public.v_customer_active WHERE cust_no = 'C-004'
        ),
        format('Expected 4; got %s.', customer_active_count)
    );

    PERFORM pg_temp.s2_dba_assert(
        'Product User view count is 4 and excludes P-004',
        product_active_count = 4
        AND NOT EXISTS (
            SELECT 1 FROM public.v_product_active WHERE prod_code = 'P-004'
        ),
        format('Expected 4; got %s.', product_active_count)
    );

    PERFORM pg_temp.s2_dba_assert(
        'P-004 has no current price in the User view',
        NOT EXISTS (
            SELECT 1
            FROM public.v_product_active
            WHERE prod_code = 'P-004'
        ),
        'P-004 was exposed to a User.'
    );

    PERFORM set_config('app.current_user', admin_email, TRUE);

    SELECT count(*)
      INTO customer_all_count
      FROM public.v_customer_admin
     WHERE cust_no BETWEEN 'C-001' AND 'C-005';

    SELECT count(*)
      INTO product_all_count
      FROM public.v_product_admin
     WHERE prod_code BETWEEN 'P-001' AND 'P-005';

    SELECT count(*)
      INTO status_column_count
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('v_customer_admin', 'v_product_admin')
       AND lower(column_name) IN ('status', 'stamp');

    PERFORM pg_temp.s2_dba_assert(
        'Admin Customer view returns all 5 including C-004',
        customer_all_count = 5
        AND EXISTS (
            SELECT 1
            FROM public.v_customer_admin
            WHERE cust_no = 'C-004' AND status = 'Inactive'
        ),
        format('Expected 5; got %s.', customer_all_count)
    );

    PERFORM pg_temp.s2_dba_assert(
        'Admin Product view returns all 5 including P-004',
        product_all_count = 5
        AND EXISTS (
            SELECT 1
            FROM public.v_product_admin
            WHERE prod_code = 'P-004' AND status = 'Inactive'
        ),
        format('Expected 5; got %s.', product_all_count)
    );

    PERFORM pg_temp.s2_dba_assert(
        'Admin views expose Status and Stamp',
        status_column_count = 4,
        format('Expected 4 columns across the 2 Admin views; got %s.', status_column_count)
    );

    PERFORM pg_temp.s2_dba_assert(
        'P-003 current price remains 28.00 and P-004 remains absent',
        EXISTS (
            SELECT 1
            FROM public.v_product_admin
            WHERE prod_code = 'P-003' AND current_price = 28.00
        )
        AND EXISTS (
            SELECT 1
            FROM public.v_product_admin
            WHERE prod_code = 'P-004' AND status = 'Inactive' AND current_price IS NULL
        ),
        'P-003/P-004 derived-price verification failed.'
    );
END;
$$;

-- Re-set to the seeded User identity for a screenshot-friendly User-view table.
DO $$
DECLARE
    user_email TEXT;
BEGIN
    SELECT app_user.email
      INTO user_email
      FROM public.app_user AS app_user
      JOIN public.role AS role ON role.id = app_user.role_id
     WHERE role.name = 'User'
       AND app_user.status = 'Active'
       AND app_user.approval_status = 'approved'
       AND app_user.is_blocked = FALSE
     ORDER BY app_user.id
     LIMIT 1;
    PERFORM set_config('app.current_user', user_email, TRUE);
END;
$$;

SELECT 'User view' AS evidence,
       'v_customer_active' AS view_name,
       count(*) AS guide_row_count,
       'PASS: C-004 absent' AS result
FROM public.v_customer_active
WHERE cust_no BETWEEN 'C-001' AND 'C-005'
UNION ALL
SELECT 'User view', 'v_product_active', count(*),
       'PASS: P-004 absent'
FROM public.v_product_active
WHERE prod_code BETWEEN 'P-001' AND 'P-005';

-- Re-set to an Admin identity for an easy Admin-view screenshot.
DO $$
DECLARE
    admin_email TEXT;
BEGIN
    SELECT app_user.email
      INTO admin_email
      FROM public.app_user AS app_user
      JOIN public.role AS role ON role.id = app_user.role_id
     WHERE role.name = 'Superadmin'
       AND app_user.status = 'Active'
       AND app_user.approval_status = 'approved'
       AND app_user.is_blocked = FALSE
     ORDER BY app_user.id
     LIMIT 1;
    PERFORM set_config('app.current_user', admin_email, TRUE);
END;
$$;

SELECT 'Admin view' AS evidence,
       'v_customer_admin' AS view_name,
       count(*) AS guide_row_count,
       'PASS: C-004 included' AS result
FROM public.v_customer_admin
WHERE cust_no BETWEEN 'C-001' AND 'C-005'
UNION ALL
SELECT 'Admin view', 'v_product_admin', count(*),
       'PASS: P-004 included'
FROM public.v_product_admin
WHERE prod_code BETWEEN 'P-001' AND 'P-005';

SELECT 'Customer counts' AS evidence, status_filter, row_count
FROM public.v_customer_status_counts;

SELECT 'Product counts' AS evidence, status_filter, row_count
FROM public.v_product_status_counts;

ROLLBACK;
