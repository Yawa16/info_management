BEGIN;

DO $$
DECLARE
  v_actor_id uuid := gen_random_uuid();
  v_target_id uuid := gen_random_uuid();
  v_actor_email text := gen_random_uuid()::text || '@example.test';
  v_target_email text := gen_random_uuid()::text || '@example.test';
BEGIN
  INSERT INTO auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  )
  VALUES
    (
      v_actor_id,
      'authenticated',
      'authenticated',
      v_actor_email,
      '',
      now(),
      now(),
      now(),
      '{}'::jsonb,
      '{}'::jsonb
    ),
    (
      v_target_id,
      'authenticated',
      'authenticated',
      v_target_email,
      '',
      now(),
      now(),
      now(),
      '{}'::jsonb,
      '{}'::jsonb
    );

  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    email,
    role,
    approval_status,
    is_blocked
  )
  VALUES
    (v_actor_id, 'Test', 'Admin', v_actor_email, 'admin', 'approved', false),
    (v_target_id, 'Blocked', 'User', v_target_email, 'user', 'approved', true);

  BEGIN
    PERFORM public.save_user_rights(v_actor_id, v_target_id, '{}'::bigint[]);
    RAISE EXCEPTION 'Expected save_user_rights to reject a blocked target.';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      NULL;
  END;
END;
$$;

ROLLBACK;
