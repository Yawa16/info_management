-- Run only against a development database with migration 004 applied and at
-- least one active, unblocked app_user. Every change is rolled back below.
BEGIN;

CREATE TEMP TABLE password_reset_token_test_results (
    case_name TEXT NOT NULL,
    expected_valid BOOLEAN NOT NULL,
    actual_valid BOOLEAN NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
    test_user_id BIGINT;
    valid_hash CONSTANT VARCHAR(64) :=
        '9ebb5f538c7f7f982a999a26f35e846f29830d859aad3b026ed5ac37d3c4b69c';
    expired_hash CONSTANT VARCHAR(64) :=
        '7c432a54bb295e74ad4085619e5e9dd8ece372d41c16b4bd27938461d9507057';
    used_hash CONSTANT VARCHAR(64) :=
        'c1f46b78b0cb599ff7dc593fc4c6e2380073ba13ba553a96af26b00dd70d6db1';
    validation_result BOOLEAN;
BEGIN
    SELECT app_user.id
      INTO test_user_id
      FROM public.app_user AS app_user
     WHERE app_user.status = 'Active'
       AND app_user.is_blocked = FALSE
     ORDER BY app_user.id
     LIMIT 1
     FOR UPDATE;

    IF test_user_id IS NULL THEN
        RAISE EXCEPTION
            'Verification requires an active, unblocked app_user fixture.';
    END IF;

    UPDATE public.password_reset_token
       SET used_at = CURRENT_TIMESTAMP,
           status = 'Inactive',
           stamp = 'EDITED verification ' ||
               to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD FMHH12:MI AM')
     WHERE user_id = test_user_id
       AND used_at IS NULL
       AND status = 'Active';

    INSERT INTO public.password_reset_token (
        user_id, token_hash, purpose, created_at, expires_at, used_at
    )
    VALUES
        (test_user_id, valid_hash, 'reset_password', CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP + INTERVAL '5 minutes', NULL),
        (test_user_id, expired_hash, 'set_password', CURRENT_TIMESTAMP - INTERVAL '2 days',
            CURRENT_TIMESTAMP - INTERVAL '1 minute', NULL),
        (test_user_id, used_hash, 'reset_password', CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP + INTERVAL '5 minutes', CURRENT_TIMESTAMP);

    SELECT EXISTS (
        SELECT 1
        FROM public.password_reset_token AS token
        JOIN public.app_user AS app_user ON app_user.id = token.user_id
        WHERE token.token_hash = valid_hash
          AND token.purpose = 'reset_password'
          AND token.used_at IS NULL
          AND token.expires_at > CURRENT_TIMESTAMP
          AND token.status = 'Active'
          AND app_user.status = 'Active'
          AND app_user.is_blocked = FALSE
    ) INTO validation_result;
    INSERT INTO pg_temp.password_reset_token_test_results
    VALUES ('valid token', TRUE, validation_result);

    SELECT EXISTS (
        SELECT 1
        FROM public.password_reset_token AS token
        JOIN public.app_user AS app_user ON app_user.id = token.user_id
        WHERE token.token_hash = expired_hash
          AND token.purpose = 'set_password'
          AND token.used_at IS NULL
          AND token.expires_at > CURRENT_TIMESTAMP
          AND token.status = 'Active'
          AND app_user.status = 'Active'
          AND app_user.is_blocked = FALSE
    ) INTO validation_result;
    INSERT INTO pg_temp.password_reset_token_test_results
    VALUES ('expired token', FALSE, validation_result);

    SELECT EXISTS (
        SELECT 1
        FROM public.password_reset_token AS token
        JOIN public.app_user AS app_user ON app_user.id = token.user_id
        WHERE token.token_hash = used_hash
          AND token.purpose = 'reset_password'
          AND token.used_at IS NULL
          AND token.expires_at > CURRENT_TIMESTAMP
          AND token.status = 'Active'
          AND app_user.status = 'Active'
          AND app_user.is_blocked = FALSE
    ) INTO validation_result;
    INSERT INTO pg_temp.password_reset_token_test_results
    VALUES ('used token', FALSE, validation_result);

    UPDATE public.app_user
       SET is_blocked = TRUE
     WHERE id = test_user_id;

    SELECT EXISTS (
        SELECT 1
        FROM public.password_reset_token AS token
        JOIN public.app_user AS app_user ON app_user.id = token.user_id
        WHERE token.token_hash = valid_hash
          AND token.purpose = 'reset_password'
          AND token.used_at IS NULL
          AND token.expires_at > CURRENT_TIMESTAMP
          AND token.status = 'Active'
          AND app_user.status = 'Active'
          AND app_user.is_blocked = FALSE
    ) INTO validation_result;
    INSERT INTO pg_temp.password_reset_token_test_results
    VALUES ('blocked user', FALSE, validation_result);
END;
$$;

SELECT case_name, expected_valid, actual_valid,
       expected_valid = actual_valid AS passed
FROM pg_temp.password_reset_token_test_results
ORDER BY case_name;

ROLLBACK;
