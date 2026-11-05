ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_approval_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'active', 'rejected'));

DROP POLICY IF EXISTS "Managers can view manageable profiles"
  ON public.profiles;
DROP POLICY IF EXISTS "Managers can update manageable profiles"
  ON public.profiles;

DROP FUNCTION IF EXISTS public.can_view_managed_profile(uuid);
DROP FUNCTION IF EXISTS public.can_manage_user(uuid);

CREATE FUNCTION public.can_view_managed_profile(target_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT actor.id <> target.id
        AND actor.approval_status IN ('active', 'approved')
        AND actor.is_blocked = false
        AND (
          actor.role = 'superadmin'
          OR (
            actor.role = 'admin'
            AND target.role IN ('admin', 'user')
          )
        )
      FROM public.profiles AS actor
      JOIN public.profiles AS target ON target.id = target_profile_id
      WHERE actor.id = (SELECT auth.uid())
    ),
    false
  );
$$;

CREATE FUNCTION public.can_manage_user(target_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT actor.id <> target.id
        AND actor.approval_status IN ('active', 'approved')
        AND actor.is_blocked = false
        AND (
          actor.role = 'superadmin'
          OR (actor.role = 'admin' AND target.role = 'user')
        )
      FROM public.profiles AS actor
      JOIN public.profiles AS target ON target.id = target_profile_id
      WHERE actor.id = (SELECT auth.uid())
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_managed_profile(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_managed_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_user(uuid) TO authenticated;

CREATE POLICY "Managers can view manageable profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.can_view_managed_profile(id));

CREATE POLICY "Managers can update manageable profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_user(id))
  WITH CHECK (public.can_manage_user(id));

GRANT UPDATE (role) ON TABLE public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_last_active_superadmin_loss()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  active_superadmin_count bigint;
  removes_active_superadmin boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    removes_active_superadmin :=
      OLD.role = 'superadmin'
      AND OLD.approval_status IN ('active', 'approved')
      AND OLD.is_blocked = false;
  ELSE
    removes_active_superadmin :=
      OLD.role = 'superadmin'
      AND OLD.approval_status IN ('active', 'approved')
      AND OLD.is_blocked = false
      AND NOT (
        NEW.role = 'superadmin'
        AND NEW.approval_status IN ('active', 'approved')
        AND NEW.is_blocked = false
      );
  END IF;

  IF removes_active_superadmin THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(641235901);

    SELECT count(*)
      INTO active_superadmin_count
      FROM public.profiles
      WHERE role = 'superadmin'
        AND approval_status IN ('active', 'approved')
        AND is_blocked = false;

    IF active_superadmin_count <= 1 THEN
      RAISE EXCEPTION
        'This action is blocked because at least one active Superadmin must remain.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_last_active_superadmin_loss
  ON public.profiles;

CREATE TRIGGER prevent_last_active_superadmin_loss
  BEFORE UPDATE OF role, approval_status, is_blocked OR DELETE
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_last_active_superadmin_loss();
