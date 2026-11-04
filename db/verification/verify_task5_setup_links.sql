-- Run against a development database after migrations 001-004.
-- All account changes, tokens, and audit entries are rolled back.
BEGIN;

CREATE TEMP TABLE task5_setup_test_results (
    case_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    details TEXT NOT NULL
) ON COMMIT DROP;

CREATE FUNCTION pg_temp.task5_setup_report(
    test_name TEXT,
    test_passed BOOLEAN,
    test_details TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO pg_temp.task5_setup_test_results (case_name, passed, details)
    VALUES (test_name, test_passed, COALESCE(test_details, ''));

    IF test_passed THEN
        RAISE NOTICE 'PASS: %', test_name;
    ELSE
        RAISE NOTICE 'FAIL: % - %', test_name, test_details;
    END IF;
END;
$$;

DO $$
DECLARE
    test_user_id BIGINT;
    first_hash TEXT := md5(random()::TEXT || clock_timestamp()::TEXT)
        || md5(random()::TEXT || clock_timestamp()::TEXT);
    second_hash TEXT := md5(random()::TEXT || clock_timestamp()::TEXT)
        || md5(random()::TEXT || clock_timestamp()::TEXT);
    expired_hash TEXT := md5(random()::TEXT || clock_timestamp()::TEXT)
        || md5(random()::TEXT || clock_timestamp()::TEXT);
    valid_token BOOLEAN;
    invalidated_token BOOLEAN;
    consumed_token BOOLEAN;
    expired_token BOOLEAN;
    changed_rows INTEGER;
BEGIN
    SELECT app_user.id
      INTO test_user_id
      FROM public.app_user AS app_user
     WHERE app_user.status = 'Active'
       AND app_user.is_blocked = FALSE
       AND app_user.approval_status = 'approved'
     ORDER BY app_user.id
     LIMIT 1
     FOR UPDATE;

    IF test_user_id IS NULL THEN
        RAISE EXCEPTION
            'Verification requires an active, approved, unblocked app_user.';
    END IF;

    PERFORM set_config('app.current_user', 'task5-verification', TRUE);

    UPDATE public.app_user
       SET password_hash = NULL,
           must_set_password = TRUE
     WHERE id = test_user_id;

    UPDATE public.password_reset_token
       SET used_at = CURRENT_TIMESTAMP,
           status = 'Inactive'
     WHERE user_id = test_user_id
       AND purpose = 'set_password'
       AND used_at IS NULL
       AND status = 'Active';

    INSERT INTO public.password_reset_token (
        user_id, token_hash, purpose, expires_at
    )
    VALUES (
        test_user_id, first_hash, 'set_password',
        CURRENT_TIMESTAMP + INTERVAL '1 hour'
    );

    SELECT EXISTS (
        SELECT 1
        FROM public.password_reset_token AS token
        JOIN public.app_user AS app_user ON app_user.id = token.user_id
        WHERE token.token_hash = first_hash
          AND token.purpose = 'set_password'
          AND token.used_at IS NULL
          AND token.expires_at > CURRENT_TIMESTAMP
          AND token.status = 'Active'
          AND app_user.password_hash IS NULL
          AND app_user.must_set_password = TRUE
          AND app_user.approval_status = 'approved'
          AND app_user.status = 'Active'
          AND app_user.is_blocked = FALSE
    ) INTO valid_token;
    PERFORM pg_temp.task5_setup_report(
        'new setup link is valid for an eligible account',
        valid_token,
        'new setup link failed the application eligibility checks'
    );

    UPDATE public.password_reset_token
       SET used_at = CURRENT_TIMESTAMP,
           status = 'Inactive'
     WHERE user_id = test_user_id
       AND purpose = 'set_password'
       AND used_at IS NULL
       AND status = 'Active';

    INSERT INTO public.password_reset_token (
        user_id, token_hash, purpose, expires_at
    )
    VALUES (
        test_user_id, second_hash, 'set_password',
        CURRENT_TIMESTAMP + INTERVAL '1 hour'
    );

    SELECT EXISTS (
        SELECT 1
        FROM public.password_reset_token AS token
        JOIN public.app_user AS app_user ON app_user.id = token.user_id
        WHERE token.token_hash = first_hash
          AND token.purpose = 'set_password'
          AND token.used_at IS NULL
          AND token.expires_at > CURRENT_TIMESTAMP
          AND token.status = 'Active'
          AND app_user.password_hash IS NULL
          AND app_user.must_set_password = TRUE
          AND app_user.approval_status = 'approved'
          AND app_user.status = 'Active'
          AND app_user.is_blocked = FALSE
    ) INTO invalidated_token;

    SELECT EXISTS (
        SELECT 1
        FROM public.password_reset_token AS token
        JOIN public.app_user AS app_user ON app_user.id = token.user_id
        WHERE token.token_hash = second_hash
          AND token.purpose = 'set_password'
          AND token.used_at IS NULL
          AND token.expires_at > CURRENT_TIMESTAMP
          AND token.status = 'Active'
          AND app_user.password_hash IS NULL
          AND app_user.must_set_password = TRUE
          AND app_user.approval_status = 'approved'
          AND app_user.status = 'Active'
          AND app_user.is_blocked = FALSE
    ) INTO valid_token;
    PERFORM pg_temp.task5_setup_report(
        'rotating a setup link invalidates the old link and accepts only the new one',
        NOT invalidated_token AND valid_token,
        'setup-link rotation did not invalidate the old link exclusively'
    );

    UPDATE public.password_reset_token
       SET used_at = CURRENT_TIMESTAMP,
           status = 'Inactive'
     WHERE token_hash = second_hash
       AND used_at IS NULL
       AND status = 'Active'
       AND expires_at > CURRENT_TIMESTAMP;
    GET DIAGNOSTICS changed_rows = ROW_COUNT;

    SELECT EXISTS (
        SELECT 1
        FROM public.password_reset_token AS token
        JOIN public.app_user AS app_user ON app_user.id = token.user_id
        WHERE token.token_hash = second_hash
          AND token.purpose = 'set_password'
          AND token.used_at IS NULL
          AND token.expires_at > CURRENT_TIMESTAMP
          AND token.status = 'Active'
          AND app_user.password_hash IS NULL
          AND app_user.must_set_password = TRUE
          AND app_user.approval_status = 'approved'
          AND app_user.status = 'Active'
          AND app_user.is_blocked = FALSE
    ) INTO consumed_token;
    PERFORM pg_temp.task5_setup_report(
        'a consumed setup link cannot be used a second time',
        changed_rows = 1 AND NOT consumed_token,
        'consumed setup link remained valid or was not marked used'
    );

    INSERT INTO public.password_reset_token (
        user_id, token_hash, purpose, created_at, expires_at
    )
    VALUES (
        test_user_id, expired_hash, 'set_password',
        CURRENT_TIMESTAMP - INTERVAL '2 hours',
        CURRENT_TIMESTAMP - INTERVAL '1 hour'
    );

    SELECT EXISTS (
        SELECT 1
        FROM public.password_reset_token AS token
        JOIN public.app_user AS app_user ON app_user.id = token.user_id
        WHERE token.token_hash = expired_hash
          AND token.purpose = 'set_password'
          AND token.used_at IS NULL
          AND token.expires_at > CURRENT_TIMESTAMP
          AND token.status = 'Active'
          AND app_user.password_hash IS NULL
          AND app_user.must_set_password = TRUE
          AND app_user.approval_status = 'approved'
          AND app_user.status = 'Active'
          AND app_user.is_blocked = FALSE
    ) INTO expired_token;
    PERFORM pg_temp.task5_setup_report(
        'an expired setup link is rejected',
        NOT expired_token,
        'expired setup link remained valid'
    );
END;
$$;

SELECT case_name,
       CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS result,
       details
FROM pg_temp.task5_setup_test_results
ORDER BY case_name;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_temp.task5_setup_test_results WHERE NOT passed
    ) THEN
        RAISE EXCEPTION 'Task 5 setup-link verification failed.';
    END IF;
END;
$$;

ROLLBACK;
