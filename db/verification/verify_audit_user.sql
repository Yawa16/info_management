-- Run against a disposable development database after migrations 001-005.
-- This file rolls back every fixture and audit row. The full npm verification
-- runner also executes pooling and two-session tests that SQL alone cannot
-- reliably coordinate.
BEGIN;

CREATE TEMP TABLE audit_test_results (
    case_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    details TEXT NOT NULL
) ON COMMIT DROP;

CREATE FUNCTION pg_temp.audit_test_report(
    test_name TEXT,
    test_passed BOOLEAN,
    test_details TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO pg_temp.audit_test_results (case_name, passed, details)
    VALUES (test_name, test_passed, COALESCE(test_details, ''));

    IF test_passed THEN
        RAISE NOTICE 'PASS: %', test_name;
    ELSE
        RAISE NOTICE 'FAIL: % - %', test_name, test_details;
    END IF;
END;
$$;

CREATE FUNCTION pg_temp.audit_test_assert(condition BOOLEAN, failure TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF condition IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION '%', failure;
    END IF;
END;
$$;

DO $$
DECLARE
    customer_key TEXT := 'A' || substr(md5(random()::TEXT || clock_timestamp()::TEXT), 1, 9);
    no_user_key TEXT := 'S' || substr(md5(random()::TEXT || clock_timestamp()::TEXT), 1, 9);
    action_value TEXT;
    actor_value TEXT;
    stamp_value TEXT;
    test_error TEXT;
    target_user_id BIGINT;
    grantor_user_id BIGINT;
    permission_right_id BIGINT;
    token_id BIGINT;
    permission_key TEXT;
    sensitive_values_found BOOLEAN;
    update_blocked BOOLEAN;
    delete_blocked BOOLEAN;
    truncate_blocked BOOLEAN;
    app_role_available BOOLEAN;
    rollback_key TEXT := 'R' || substr(md5(random()::TEXT || clock_timestamp()::TEXT), 1, 9);
    rollback_id BIGINT;
BEGIN
    test_error := NULL;
    BEGIN
        PERFORM set_config('app.current_user', 'lisa@hope.com', TRUE);
        INSERT INTO public.customer (cust_no, cust_name, stamp)
        VALUES (customer_key, 'Audit verification insert', 'caller-supplied');

        SELECT audit.action, audit.app_user, audit.new_values ->> 'stamp'
          INTO action_value, actor_value, stamp_value
          FROM public.audit_log AS audit
         WHERE audit.table_name = 'customer'
           AND audit.record_key = jsonb_build_object('cust_no', customer_key)::TEXT
         ORDER BY audit.id DESC
         LIMIT 1;

        PERFORM pg_temp.audit_test_assert(
            action_value = 'CREATED' AND actor_value = 'lisa@hope.com',
            'INSERT did not record CREATED and lisa@hope.com'
        );
        PERFORM pg_temp.audit_test_assert(
            stamp_value = format(
                'CREATED lisa@hope.com %s',
                to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD FMHH12:MI AM')
            ),
            'INSERT stamp did not match actor/action in Asia/Manila time'
        );
    EXCEPTION WHEN OTHERS THEN
        test_error := SQLERRM;
    END;
    PERFORM pg_temp.audit_test_report(
        '1. insert records application user and stamp',
        test_error IS NULL,
        test_error
    );

    test_error := NULL;
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM public.customer WHERE cust_no = customer_key
        ) THEN
            RAISE EXCEPTION 'insert fixture was not created';
        END IF;
        PERFORM set_config('app.current_user', 'maria@hope.com', TRUE);
        UPDATE public.customer
           SET cust_name = 'Audit verification edited'
         WHERE cust_no = customer_key;

        SELECT audit.action, audit.app_user, audit.new_values ->> 'stamp'
          INTO action_value, actor_value, stamp_value
          FROM public.audit_log AS audit
         WHERE audit.table_name = 'customer'
           AND audit.record_key = jsonb_build_object('cust_no', customer_key)::TEXT
         ORDER BY audit.id DESC
         LIMIT 1;
        PERFORM pg_temp.audit_test_assert(
            action_value = 'EDITED'
                AND actor_value = 'maria@hope.com'
                AND stamp_value LIKE 'EDITED maria@hope.com %',
            'UPDATE did not record EDITED and the second application user'
        );
    EXCEPTION WHEN OTHERS THEN
        test_error := SQLERRM;
    END;
    PERFORM pg_temp.audit_test_report(
        '2. update records the second application user',
        test_error IS NULL,
        test_error
    );

    test_error := NULL;
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM public.customer
            WHERE cust_no = customer_key AND cust_name = 'Audit verification edited'
        ) THEN
            RAISE EXCEPTION 'edited fixture was not created';
        END IF;
        PERFORM set_config('app.current_user', 'lisa@hope.com', TRUE);
        UPDATE public.customer SET status = 'Inactive' WHERE cust_no = customer_key;
        UPDATE public.customer SET status = 'Active' WHERE cust_no = customer_key;

        PERFORM pg_temp.audit_test_assert(
            EXISTS (
                SELECT 1 FROM public.audit_log
                WHERE table_name = 'customer'
                  AND record_key = jsonb_build_object('cust_no', customer_key)::TEXT
                  AND action = 'DELETED'
                  AND app_user = 'lisa@hope.com'
            ),
            'soft delete was not logged as DELETED'
        );
        PERFORM pg_temp.audit_test_assert(
            EXISTS (
                SELECT 1 FROM public.audit_log
                WHERE table_name = 'customer'
                  AND record_key = jsonb_build_object('cust_no', customer_key)::TEXT
                  AND action = 'RESTORED'
                  AND app_user = 'lisa@hope.com'
            ),
            'reactivation was not logged as RESTORED'
        );
    EXCEPTION WHEN OTHERS THEN
        test_error := SQLERRM;
    END;
    PERFORM pg_temp.audit_test_report(
        '3. soft delete and restore actions',
        test_error IS NULL,
        test_error
    );

    test_error := NULL;
    BEGIN
        PERFORM set_config('app.current_user', '', TRUE);
        INSERT INTO public.customer (cust_no, cust_name, stamp)
        VALUES (no_user_key, 'Audit system fallback', 'caller-supplied');

        SELECT audit.action, audit.app_user, audit.new_values ->> 'stamp'
          INTO action_value, actor_value, stamp_value
          FROM public.audit_log AS audit
         WHERE audit.table_name = 'customer'
           AND audit.record_key = jsonb_build_object('cust_no', no_user_key)::TEXT
         ORDER BY audit.id DESC
         LIMIT 1;
        PERFORM pg_temp.audit_test_assert(
            action_value = 'CREATED'
                AND actor_value = 'system'
                AND stamp_value LIKE 'CREATED system %',
            'unset application identity did not fall back to system'
        );
    EXCEPTION WHEN OTHERS THEN
        test_error := SQLERRM;
    END;
    PERFORM pg_temp.audit_test_report(
        '4. missing user falls back to system without blocking write',
        test_error IS NULL,
        test_error
    );

    test_error := NULL;
    BEGIN
        SELECT grantor.id
          INTO grantor_user_id
          FROM public.app_user AS grantor
          JOIN public.role AS grantor_role ON grantor_role.id = grantor.role_id
         WHERE grantor.status = 'Active'
           AND grantor.is_blocked = FALSE
           AND grantor.approval_status = 'approved'
           AND grantor_role.status = 'Active'
           AND grantor_role.name IN ('Admin', 'Superadmin')
         ORDER BY grantor.id
         LIMIT 1
         FOR UPDATE OF grantor;
        SELECT target.id
          INTO target_user_id
          FROM public.app_user AS target
         WHERE target.status = 'Active'
           AND target.is_blocked = FALSE
           AND target.approval_status = 'approved'
           AND target.id <> grantor_user_id
         ORDER BY target.id
         LIMIT 1
         FOR UPDATE OF target;
        SELECT candidate.id
          INTO permission_right_id
          FROM public.rights AS candidate
         WHERE candidate.status = 'Active'
           AND NOT EXISTS (
               SELECT 1
               FROM public.user_permission AS permission
               WHERE permission.user_id = target_user_id
                 AND permission.right_id = candidate.id
           )
         ORDER BY candidate.id
         LIMIT 1;

        IF grantor_user_id IS NULL OR target_user_id IS NULL OR permission_right_id IS NULL THEN
            RAISE EXCEPTION
                'requires an approved active Admin/Superadmin, another active user, and an unassigned right';
        END IF;

        permission_key := jsonb_build_object(
            'user_id', target_user_id,
            'right_id', permission_right_id
        )::TEXT;
        PERFORM set_config('app.current_user', 'permissions@hope.com', TRUE);
        INSERT INTO public.user_permission (user_id, right_id, granted_by, status)
        VALUES (target_user_id, permission_right_id, grantor_user_id, 'Active');
        UPDATE public.user_permission
           SET status = 'Inactive'
         WHERE user_id = target_user_id
           AND right_id = permission_right_id;

        PERFORM pg_temp.audit_test_assert(
            EXISTS (
                SELECT 1 FROM public.audit_log
                WHERE table_name = 'user_permission'
                  AND record_key = permission_key
                  AND action = 'CREATED'
                  AND app_user = 'permissions@hope.com'
            )
            AND EXISTS (
                SELECT 1 FROM public.audit_log
                WHERE table_name = 'user_permission'
                  AND record_key = permission_key
                  AND action = 'DELETED'
                  AND app_user = 'permissions@hope.com'
            ),
            'permission tick/untick was not audited'
        );

        UPDATE public.app_user
           SET password_hash = 'audit-test-only'
         WHERE id = target_user_id;

        INSERT INTO public.password_reset_token (
            user_id, token_hash, purpose, expires_at
        )
        VALUES (
            target_user_id,
            md5(random()::TEXT || clock_timestamp()::TEXT)
                || md5(random()::TEXT || clock_timestamp()::TEXT),
            'reset_password',
            CURRENT_TIMESTAMP + INTERVAL '5 minutes'
        )
        RETURNING id INTO token_id;

        SELECT EXISTS (
            SELECT 1
            FROM public.audit_log AS audit
            WHERE audit.id > 0
              AND (
                  audit.table_name = 'user_permission'
                  AND audit.record_key = permission_key
                  OR audit.table_name = 'app_user'
                  AND audit.record_key = jsonb_build_object('id', target_user_id)::TEXT
                  OR audit.table_name = 'password_reset_token'
                  AND audit.record_key = jsonb_build_object('id', token_id)::TEXT
              )
              AND (
                  COALESCE(audit.old_values, '{}'::JSONB)
                      ?| ARRAY['password_hash', 'token_hash']
                  OR COALESCE(audit.new_values, '{}'::JSONB)
                      ?| ARRAY['password_hash', 'token_hash']
              )
        ) INTO sensitive_values_found;
        PERFORM pg_temp.audit_test_assert(
            NOT sensitive_values_found,
            'password_hash or token_hash appeared in audit old/new values'
        );
    EXCEPTION WHEN OTHERS THEN
        test_error := SQLERRM;
    END;
    PERFORM pg_temp.audit_test_report(
        '7. permission changes are audited and secrets are excluded',
        test_error IS NULL,
        test_error
    );

    test_error := NULL;
    BEGIN
        INSERT INTO public.audit_log (
            table_name, record_key, action, app_user, db_user, old_values, new_values
        )
        VALUES (
            'audit_log_test', '{}', 'CREATED', 'system', SESSION_USER, NULL, NULL
        )
        RETURNING id INTO rollback_id;

        SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
          INTO app_role_available;
        PERFORM pg_temp.audit_test_assert(
            app_role_available,
            'authenticated role is required to verify app-role restrictions'
        );

        EXECUTE 'SET LOCAL ROLE authenticated';
        update_blocked := FALSE;
        BEGIN
            UPDATE public.audit_log
               SET app_user = 'tampered'
             WHERE id = rollback_id;
        EXCEPTION WHEN insufficient_privilege THEN
            update_blocked := TRUE;
        END;

        EXECUTE 'RESET ROLE';
        EXECUTE 'SET LOCAL ROLE authenticated';
        delete_blocked := FALSE;
        BEGIN
            DELETE FROM public.audit_log WHERE id = rollback_id;
        EXCEPTION WHEN insufficient_privilege THEN
            delete_blocked := TRUE;
        END;

        EXECUTE 'RESET ROLE';
        EXECUTE 'SET LOCAL ROLE authenticated';
        truncate_blocked := FALSE;
        BEGIN
            TRUNCATE TABLE public.audit_log;
        EXCEPTION WHEN insufficient_privilege THEN
            truncate_blocked := TRUE;
        END;
        EXECUTE 'RESET ROLE';

        PERFORM pg_temp.audit_test_assert(
            update_blocked AND delete_blocked AND truncate_blocked,
            'authenticated role was able to UPDATE, DELETE, or TRUNCATE audit_log'
        );
    EXCEPTION WHEN OTHERS THEN
        test_error := SQLERRM;
    END;
    PERFORM pg_temp.audit_test_report(
        '8. audit_log UPDATE, DELETE, and TRUNCATE are rejected',
        test_error IS NULL,
        test_error
    );

    test_error := NULL;
    BEGIN
        BEGIN
            PERFORM set_config('app.current_user', 'rollback@hope.com', TRUE);
            INSERT INTO public.customer (cust_no, cust_name, stamp)
            VALUES (rollback_key, 'Audit rollback fixture', 'caller-supplied');
            SELECT audit.id
              INTO rollback_id
              FROM public.audit_log AS audit
             WHERE audit.table_name = 'customer'
               AND audit.record_key = jsonb_build_object('cust_no', rollback_key)::TEXT
             ORDER BY audit.id DESC
             LIMIT 1;
            RAISE EXCEPTION USING
                ERRCODE = 'P0001',
                MESSAGE = 'expected audit rollback test';
        EXCEPTION WHEN SQLSTATE 'P0001' THEN
            NULL;
        END;

        PERFORM pg_temp.audit_test_assert(
            NOT EXISTS (
                SELECT 1 FROM public.audit_log WHERE id = rollback_id
            )
            AND NOT EXISTS (
                SELECT 1 FROM public.customer WHERE cust_no = rollback_key
            ),
            'rolled-back write left a row or audit entry'
        );
    EXCEPTION WHEN OTHERS THEN
        test_error := SQLERRM;
    END;
    PERFORM pg_temp.audit_test_report(
        '9. rollback leaves no audit row',
        test_error IS NULL,
        test_error
    );
END;
$$;

SELECT case_name, CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS result, details
FROM pg_temp.audit_test_results
ORDER BY case_name;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_temp.audit_test_results WHERE NOT passed) THEN
        RAISE EXCEPTION 'Audit verification failed; see FAIL results above.';
    END IF;
END;
$$;

ROLLBACK;
