-- Expected: three active roles: Admin, Superadmin, and User.
SELECT name, status
FROM public.role
ORDER BY name;

-- Expected: all seven foreign keys are present:
-- app_user.role_id -> role.id, app_user.employee_id -> employee.emp_no,
-- rights.module_id -> module.id, user_permission.user_id -> app_user.id,
-- user_permission.right_id -> rights.id, user_permission.granted_by -> app_user.id,
-- app_user.auth_user_id -> auth.users.id.
WITH expected (constraint_name) AS (
    VALUES
        ('app_user_role_id_fkey'),
        ('app_user_auth_user_id_fkey'),
        ('app_user_employee_id_fkey'),
        ('rights_module_id_fkey'),
        ('user_permission_user_id_fkey'),
        ('user_permission_right_id_fkey'),
        ('user_permission_granted_by_fkey')
)
SELECT expected.constraint_name,
       constraints.constraint_name IS NOT NULL AS present
FROM expected
LEFT JOIN information_schema.table_constraints AS constraints
  ON constraints.constraint_schema = 'public'
 AND constraints.constraint_type = 'FOREIGN KEY'
 AND constraints.constraint_name = expected.constraint_name
ORDER BY expected.constraint_name;

-- Expected: zero from each orphan check.
SELECT 'app_user.role_id -> role.id' AS relationship, COUNT(*) AS orphan_count
FROM public.app_user AS app_user
LEFT JOIN public.role AS role ON role.id = app_user.role_id
WHERE role.id IS NULL
UNION ALL
SELECT 'app_user.auth_user_id -> auth.users.id', COUNT(*)
FROM public.app_user AS app_user
LEFT JOIN auth.users AS auth_user ON auth_user.id = app_user.auth_user_id
WHERE auth_user.id IS NULL
UNION ALL
SELECT 'rights.module_id -> module.id', COUNT(*)
FROM public.rights AS rights
LEFT JOIN public.module AS module ON module.id = rights.module_id
WHERE module.id IS NULL
UNION ALL
SELECT 'user_permission.user_id -> app_user.id', COUNT(*)
FROM public.user_permission AS permission
LEFT JOIN public.app_user AS app_user ON app_user.id = permission.user_id
WHERE app_user.id IS NULL
UNION ALL
SELECT 'user_permission.right_id -> rights.id', COUNT(*)
FROM public.user_permission AS permission
LEFT JOIN public.rights AS rights ON rights.id = permission.right_id
WHERE rights.id IS NULL
UNION ALL
SELECT 'user_permission.granted_by -> app_user.id', COUNT(*)
FROM public.user_permission AS permission
LEFT JOIN public.app_user AS grantor ON grantor.id = permission.granted_by
WHERE grantor.id IS NULL
ORDER BY relationship;

-- Expected active rights: Customer 3, Product 6, Human Resources 13,
-- Sales 7, Reports 7; each passed value must be true.
WITH expected (module_code, expected_count) AS (
    VALUES
        ('CUSTOMER', 3),
        ('PRODUCT', 6),
        ('HUMAN_RESOURCES', 13),
        ('SALES', 7),
        ('REPORTS', 7)
)
SELECT expected.module_code,
       expected.expected_count,
       COALESCE(counts.active_right_count, 0) AS actual_count,
       COALESCE(counts.active_right_count, 0) = expected.expected_count AS passed
FROM expected
LEFT JOIN public.v_rights_counts_by_module AS counts
  ON counts.module_code = expected.module_code
ORDER BY expected.module_code;

-- Expected: 5 RLS-enabled user-management tables and 2 views.
SELECT COUNT(*) = 5 AS five_tables_have_rls
FROM pg_class AS relation
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relkind = 'r'
  AND relation.relname IN ('role', 'app_user', 'module', 'rights', 'user_permission')
  AND relation.relrowsecurity;

SELECT viewname
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('v_user_effective_rights', 'v_rights_counts_by_module')
ORDER BY viewname;

-- Expected: the active-user permission lookup index exists.
SELECT to_regclass('public.user_permission_active_user_idx') IS NOT NULL
       AS active_permission_lookup_index_exists;

-- Example server lookup for a single login (replace the parameter):
-- SELECT user_id, module_code, right_code, granted
-- FROM public.v_user_effective_rights
-- WHERE email = lower($1)
-- ORDER BY module_code, right_code;
-- A Superadmin receives granted=true for all 36 active rights implicitly.
