-- One-time transition after migrations 001-003 and the public.profiles
-- migration have both been applied. This is intentionally outside db/migrations
-- because the Task 3 migration chain does not depend on the registration branch.
BEGIN;

INSERT INTO public.app_user (
    auth_user_id,
    first_name,
    last_name,
    email,
    role_id,
    approval_status,
    is_blocked,
    password_hash,
    must_set_password,
    last_login_at,
    stamp
)
SELECT profile.id,
       profile.first_name,
       profile.last_name,
       lower(btrim(profile.email)),
       role.id,
       profile.approval_status,
       FALSE,
       NULL,
       FALSE,
       NULL,
       'CREATED profile-backfill ' ||
           to_char(profile.created_at, 'YYYY-MM-DD FMHH12:MI AM')
FROM public.profiles AS profile
JOIN public.role AS role
  ON lower(role.name) = lower(profile.role)
 AND role.status = 'Active'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.app_user AS existing
    WHERE existing.auth_user_id = profile.id
);

COMMIT;
