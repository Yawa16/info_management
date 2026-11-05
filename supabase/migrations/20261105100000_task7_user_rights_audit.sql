-- Task 7: per-user rights and the audit trail of every rights change.
-- Requires the DB Admin's public.rights catalogue (and public.module) to exist.

CREATE TABLE IF NOT EXISTS public.user_rights (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  right_id bigint NOT NULL REFERENCES public.rights (id) ON DELETE RESTRICT,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, right_id)
);

CREATE INDEX IF NOT EXISTS user_rights_right_idx
  ON public.user_rights (right_id);

-- Rights changes are written to the DB Admin's generic public.audit_log
-- (migration 005_create_audit_log.sql); this migration does not create it.
DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'audit_log'
        AND column_name = 'app_user'
    ) THEN
    RAISE EXCEPTION
      'Apply the DB Admin migration 005_create_audit_log.sql before this migration.';
  END IF;
END;
$$;

ALTER TABLE public.user_rights ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_rights FROM anon, authenticated;
GRANT SELECT ON TABLE public.user_rights TO authenticated;

DROP POLICY IF EXISTS "Users can read their own rights" ON public.user_rights;
CREATE POLICY "Users can read their own rights"
  ON public.user_rights
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Replaces a user's rights with the selected set and writes one audit_log row
-- per granted or revoked right, all in a single transaction. Only the server
-- (service role) may call it; the rules are re-checked here as defense in depth.
CREATE OR REPLACE FUNCTION public.save_user_rights(
  p_actor_id uuid,
  p_target_id uuid,
  p_right_ids bigint[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor record;
  v_target record;
  v_selected bigint[];
  v_granted integer;
  v_revoked integer;
BEGIN
  SELECT role, approval_status, is_blocked
    INTO v_actor
    FROM public.profiles
    WHERE id = p_actor_id;

  IF NOT FOUND
    OR v_actor.role NOT IN ('admin', 'superadmin')
    OR v_actor.approval_status NOT IN ('active', 'approved')
    OR v_actor.is_blocked THEN
    RAISE EXCEPTION 'Only an active Admin or Superadmin can change rights.'
      USING ERRCODE = '42501';
  END IF;

  IF p_actor_id = p_target_id THEN
    RAISE EXCEPTION 'You cannot change your own rights.'
      USING ERRCODE = '42501';
  END IF;

  SELECT role, approval_status
    INTO v_target
    FROM public.profiles
    WHERE id = p_target_id
    FOR UPDATE;

  IF NOT FOUND
    OR v_target.role <> 'user'
    OR v_target.approval_status NOT IN ('active', 'approved') THEN
    RAISE EXCEPTION 'Rights can only be set for active regular Users.'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT id), '{}')
    INTO v_selected
    FROM unnest(COALESCE(p_right_ids, '{}')) AS id;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_selected) AS selected (id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.rights AS r
      WHERE r.id = selected.id
        AND r.status = 'Active'
    )
  ) THEN
    RAISE EXCEPTION 'One or more selected rights are not in the catalogue.'
      USING ERRCODE = '23514';
  END IF;

  WITH removed AS (
    DELETE FROM public.user_rights AS ur
    WHERE ur.user_id = p_target_id
      AND NOT (ur.right_id = ANY (v_selected))
    RETURNING ur.right_id
  ),
  added AS (
    INSERT INTO public.user_rights (user_id, right_id, granted_by)
    SELECT p_target_id, selected.id, p_actor_id
    FROM unnest(v_selected) AS selected (id)
    ON CONFLICT (user_id, right_id) DO NOTHING
    RETURNING right_id
  ),
  log_removed AS (
    INSERT INTO public.audit_log
      (table_name, record_key, action, app_user, db_user, old_values, new_values)
    SELECT 'user_rights',
           p_target_id::text || ':' || r.code,
           'DELETED',
           p_actor_id::text,
           current_user::text,
           jsonb_build_object(
             'change', 'revoked',
             'changed_by', p_actor_id,
             'user_id', p_target_id,
             'right_id', r.id,
             'right_code', r.code
           ),
           NULL
    FROM removed
    JOIN public.rights AS r ON r.id = removed.right_id
    RETURNING 1
  ),
  log_added AS (
    INSERT INTO public.audit_log
      (table_name, record_key, action, app_user, db_user, old_values, new_values)
    SELECT 'user_rights',
           p_target_id::text || ':' || r.code,
           'CREATED',
           p_actor_id::text,
           current_user::text,
           NULL,
           jsonb_build_object(
             'change', 'granted',
             'changed_by', p_actor_id,
             'user_id', p_target_id,
             'right_id', r.id,
             'right_code', r.code
           )
    FROM added
    JOIN public.rights AS r ON r.id = added.right_id
    RETURNING 1
  )
  SELECT (SELECT count(1) FROM added), (SELECT count(1) FROM removed)
    INTO v_granted, v_revoked;

  RETURN jsonb_build_object('granted', v_granted, 'revoked', v_revoked);
END;
$$;

REVOKE ALL ON FUNCTION public.save_user_rights(uuid, uuid, bigint[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_user_rights(uuid, uuid, bigint[])
  TO service_role;
