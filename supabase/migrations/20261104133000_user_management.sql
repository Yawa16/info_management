CREATE OR REPLACE FUNCTION public.can_view_managed_profile(target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT actor.id <> target.id
        AND actor.approval_status = 'approved'
        AND actor.is_blocked = false
        AND (
          actor.role = 'superadmin'
          OR (
            actor.role = 'admin'
            AND target.role IN ('admin', 'user')
          )
        )
      FROM public.profiles AS actor
      JOIN public.profiles AS target ON target.id = target_id
      WHERE actor.id = (SELECT auth.uid())
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_user(target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT actor.id <> target.id
        AND actor.approval_status = 'approved'
        AND actor.is_blocked = false
        AND (
          actor.role = 'superadmin'
          OR (actor.role = 'admin' AND target.role = 'user')
        )
      FROM public.profiles AS actor
      JOIN public.profiles AS target ON target.id = target_id
      WHERE actor.id = (SELECT auth.uid())
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_managed_profile(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_managed_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_user(uuid) TO authenticated;

GRANT UPDATE (first_name, last_name, email, is_blocked)
  ON TABLE public.profiles TO authenticated;

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
