CREATE TABLE public.role (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(30) NOT NULL UNIQUE,
    description VARCHAR(200) NOT NULL,
    status VARCHAR(8) NOT NULL DEFAULT 'Active'
        CONSTRAINT role_status_check CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL
        DEFAULT ('CREATED system ' || to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD FMHH12:MI AM'))
);

INSERT INTO public.role (name, description, stamp) VALUES
    ('Superadmin', 'All rights are granted implicitly; manages administrators.', 'CREATED system 2026-11-01 9:00 AM'),
    ('Admin', 'Manages application records, users, and user permissions.', 'CREATED system 2026-11-01 9:00 AM'),
    ('User', 'Receives only explicitly granted rights.', 'CREATED system 2026-11-01 9:00 AM')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE public.app_user (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash TEXT,
    role_id BIGINT NOT NULL REFERENCES public.role (id) ON DELETE RESTRICT,
    employee_id VARCHAR(10) UNIQUE
        REFERENCES public.employee (emp_no) ON DELETE RESTRICT,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    must_set_password BOOLEAN NOT NULL DEFAULT TRUE,
    failed_login_count INTEGER NOT NULL DEFAULT 0
        CONSTRAINT app_user_failed_login_count_check CHECK (failed_login_count >= 0),
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    status VARCHAR(8) NOT NULL DEFAULT 'Active'
        CONSTRAINT app_user_status_check CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL
        DEFAULT ('CREATED system ' || to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD FMHH12:MI AM')),
    CONSTRAINT app_user_email_lower_check CHECK (email = lower(btrim(email))),
    CONSTRAINT app_user_email_not_empty_check CHECK (email <> ''),
    CONSTRAINT app_user_password_hash_not_empty_check
        CHECK (password_hash IS NULL OR btrim(password_hash) <> ''),
    CONSTRAINT app_user_password_setup_check
        CHECK (must_set_password OR password_hash IS NOT NULL)
);

CREATE UNIQUE INDEX app_user_email_lower_uq ON public.app_user (lower(email));
CREATE INDEX app_user_role_idx ON public.app_user (role_id);
CREATE INDEX app_user_employee_idx ON public.app_user (employee_id)
    WHERE employee_id IS NOT NULL;
CREATE INDEX app_user_status_idx ON public.app_user (status);

CREATE FUNCTION public.app_user_set_default_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    NEW.email := lower(btrim(NEW.email));

    IF NEW.role_id IS NULL THEN
        SELECT id
          INTO NEW.role_id
          FROM public.role
         WHERE name = 'User'
           AND status = 'Active';

        IF NEW.role_id IS NULL THEN
            RAISE EXCEPTION 'Cannot create app_user: active User role is missing.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER app_user_default_role_before_insert
    BEFORE INSERT ON public.app_user
    FOR EACH ROW EXECUTE FUNCTION public.app_user_set_default_role();

CREATE TABLE public.module (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL UNIQUE,
    sort_order SMALLINT NOT NULL UNIQUE CHECK (sort_order > 0),
    status VARCHAR(8) NOT NULL DEFAULT 'Active'
        CONSTRAINT module_status_check CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL
        DEFAULT ('CREATED system ' || to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD FMHH12:MI AM'))
);

INSERT INTO public.module (code, name, sort_order, stamp) VALUES
    ('CUSTOMER', 'Customer', 1, 'CREATED system 2026-11-01 9:00 AM'),
    ('PRODUCT', 'Product', 2, 'CREATED system 2026-11-01 9:00 AM'),
    ('HUMAN_RESOURCES', 'Human Resources', 3, 'CREATED system 2026-11-01 9:00 AM'),
    ('SALES', 'Sales', 4, 'CREATED system 2026-11-01 9:00 AM'),
    ('REPORTS', 'Reports', 5, 'CREATED system 2026-11-01 9:00 AM')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE public.rights (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    module_id BIGINT NOT NULL REFERENCES public.module (id) ON DELETE RESTRICT,
    action VARCHAR(30) NOT NULL,
    label VARCHAR(100) NOT NULL,
    sort_order SMALLINT NOT NULL CHECK (sort_order > 0),
    status VARCHAR(8) NOT NULL DEFAULT 'Active'
        CONSTRAINT rights_status_check CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL
        DEFAULT ('CREATED system ' || to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD FMHH12:MI AM')),
    CONSTRAINT rights_module_sort_order_uq UNIQUE (module_id, sort_order)
);

CREATE INDEX rights_module_idx ON public.rights (module_id);
CREATE INDEX rights_status_idx ON public.rights (status);

INSERT INTO public.rights (code, module_id, action, label, sort_order, stamp)
SELECT catalogue.code, module.id, catalogue.action, catalogue.label,
       catalogue.sort_order, 'CREATED system 2026-11-01 9:00 AM'
FROM (
    VALUES
        ('CUSTOMER_ADD', 'CUSTOMER', 'ADD', 'Add Customer', 1),
        ('CUSTOMER_EDIT', 'CUSTOMER', 'EDIT', 'Edit Customer', 2),
        ('CUSTOMER_DELETE', 'CUSTOMER', 'DELETE', 'Delete Customer', 3),

        ('PRODUCT_ADD', 'PRODUCT', 'ADD', 'Add Product', 1),
        ('PRODUCT_EDIT', 'PRODUCT', 'EDIT', 'Edit Product', 2),
        ('PRODUCT_DELETE', 'PRODUCT', 'DELETE', 'Delete Product', 3),
        ('PRODUCT_PRICE_ADD', 'PRODUCT', 'ADD', 'Add Price', 4),
        ('PRODUCT_PRICE_EDIT', 'PRODUCT', 'EDIT', 'Edit Price', 5),
        ('PRODUCT_PRICE_DELETE', 'PRODUCT', 'DELETE', 'Delete Price', 6),

        ('HR_JOB_ADD', 'HUMAN_RESOURCES', 'ADD', 'Add Job', 1),
        ('HR_JOB_EDIT', 'HUMAN_RESOURCES', 'EDIT', 'Edit Job', 2),
        ('HR_JOB_DELETE', 'HUMAN_RESOURCES', 'DELETE', 'Delete Job', 3),
        ('HR_DEPARTMENT_ADD', 'HUMAN_RESOURCES', 'ADD', 'Add Department', 4),
        ('HR_DEPARTMENT_EDIT', 'HUMAN_RESOURCES', 'EDIT', 'Edit Department', 5),
        ('HR_DEPARTMENT_DELETE', 'HUMAN_RESOURCES', 'DELETE', 'Delete Department', 6),
        ('HR_EMPLOYEE_ADD', 'HUMAN_RESOURCES', 'ADD', 'Add Employee', 7),
        ('HR_EMPLOYEE_EDIT', 'HUMAN_RESOURCES', 'EDIT', 'Edit Employee', 8),
        ('HR_EMPLOYEE_DELETE', 'HUMAN_RESOURCES', 'DELETE', 'Delete Employee', 9),
        ('HR_JOB_HISTORY_VIEW', 'HUMAN_RESOURCES', 'VIEW', 'View Job History', 10),
        ('HR_JOB_HISTORY_ADD', 'HUMAN_RESOURCES', 'ADD', 'Add Job History', 11),
        ('HR_JOB_HISTORY_EDIT', 'HUMAN_RESOURCES', 'EDIT', 'Edit Job History', 12),
        ('HR_JOB_HISTORY_DELETE', 'HUMAN_RESOURCES', 'DELETE', 'Delete Job History', 13),

        ('SALES_SALE_ADD', 'SALES', 'ADD', 'Add Sale', 1),
        ('SALES_SALE_EDIT', 'SALES', 'EDIT', 'Edit Sale', 2),
        ('SALES_SALE_DELETE', 'SALES', 'DELETE', 'Delete Sale', 3),
        ('SALES_SALE_DETAIL_VIEW', 'SALES', 'VIEW', 'View Sale Detail', 4),
        ('SALES_SALE_DETAIL_ADD', 'SALES', 'ADD', 'Add Sale Detail', 5),
        ('SALES_SALE_DETAIL_EDIT', 'SALES', 'EDIT', 'Edit Sale Detail', 6),
        ('SALES_SALE_DETAIL_DELETE', 'SALES', 'DELETE', 'Delete Sale Detail', 7),

        ('REPORT_TOP_CUSTOMERS', 'REPORTS', 'VIEW', 'Top Customers', 1),
        ('REPORT_PRODUCT_MASTER_LIST', 'REPORTS', 'VIEW', 'Product Master List', 2),
        ('REPORT_TOP_PRODUCTS', 'REPORTS', 'VIEW', 'Top Products', 3),
        ('REPORT_ACTIVE_EMPLOYEES', 'REPORTS', 'VIEW', 'Active Employees', 4),
        ('REPORT_ALL_EMPLOYEES', 'REPORTS', 'VIEW', 'All Employees', 5),
        ('REPORT_EMPLOYEE_JOB_HISTORY', 'REPORTS', 'VIEW', 'Employee Job History', 6),
        ('REPORT_TOP_SALES', 'REPORTS', 'VIEW', 'Top Sales', 7)
) AS catalogue (code, module_code, action, label, sort_order)
JOIN public.module AS module ON module.code = catalogue.module_code
ON CONFLICT (code) DO NOTHING;

CREATE TABLE public.user_permission (
    user_id BIGINT NOT NULL
        REFERENCES public.app_user (id) ON DELETE RESTRICT,
    right_id BIGINT NOT NULL
        REFERENCES public.rights (id) ON DELETE RESTRICT,
    granted_by BIGINT NOT NULL
        REFERENCES public.app_user (id) ON DELETE RESTRICT,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(8) NOT NULL DEFAULT 'Active'
        CONSTRAINT user_permission_status_check CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL
        DEFAULT ('CREATED system ' || to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD FMHH12:MI AM')),
    CONSTRAINT user_permission_pkey PRIMARY KEY (user_id, right_id)
);

CREATE INDEX user_permission_active_user_idx
    ON public.user_permission (user_id, right_id)
    WHERE status = 'Active';
CREATE INDEX user_permission_right_idx ON public.user_permission (right_id);
CREATE INDEX user_permission_granted_by_idx ON public.user_permission (granted_by);
CREATE INDEX user_permission_status_idx ON public.user_permission (status);

CREATE FUNCTION public.guard_user_permission_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    grantor_role TEXT;
BEGIN
    IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
        RAISE EXCEPTION 'Physical deletion of user permissions is forbidden; set status to Inactive.';
    END IF;

    IF NEW.status = 'Active' THEN
        SELECT role.name
          INTO grantor_role
          FROM public.app_user AS grantor
          JOIN public.role AS role ON role.id = grantor.role_id
         WHERE grantor.id = NEW.granted_by
           AND grantor.status = 'Active'
           AND grantor.is_blocked = FALSE
           AND role.status = 'Active';

        IF grantor_role IS NULL OR grantor_role NOT IN ('Admin', 'Superadmin') THEN
            RAISE EXCEPTION 'Only an active Admin or Superadmin may grant or reactivate permissions.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER user_permission_guard_before_change
    BEFORE INSERT OR UPDATE OR DELETE ON public.user_permission
    FOR EACH ROW EXECUTE FUNCTION public.guard_user_permission_changes();

CREATE TRIGGER user_permission_guard_before_truncate
    BEFORE TRUNCATE ON public.user_permission
    FOR EACH STATEMENT EXECUTE FUNCTION public.guard_user_permission_changes();

REVOKE ALL ON FUNCTION public.guard_user_permission_changes() FROM PUBLIC;

CREATE VIEW public.v_user_effective_rights
WITH (security_invoker = true)
AS
SELECT app_user.id AS user_id,
       app_user.email,
       module.code AS module_code,
       rights.code AS right_code,
       CASE
           WHEN role.name = 'Superadmin' THEN TRUE
           ELSE COALESCE(permission.status = 'Active', FALSE)
       END AS granted
FROM public.app_user AS app_user
JOIN public.role AS role
  ON role.id = app_user.role_id
 AND role.status = 'Active'
CROSS JOIN public.module AS module
JOIN public.rights AS rights
  ON rights.module_id = module.id
 AND rights.status = 'Active'
LEFT JOIN public.user_permission AS permission
  ON permission.user_id = app_user.id
 AND permission.right_id = rights.id
 AND permission.status = 'Active'
WHERE app_user.status = 'Active'
  AND module.status = 'Active';

CREATE VIEW public.v_rights_counts_by_module
WITH (security_invoker = true)
AS
SELECT module.code AS module_code,
       module.name AS module_name,
       COUNT(rights.id)::INTEGER AS active_right_count
FROM public.module AS module
LEFT JOIN public.rights AS rights
  ON rights.module_id = module.id
 AND rights.status = 'Active'
WHERE module.status = 'Active'
GROUP BY module.id, module.code, module.name, module.sort_order
ORDER BY module.sort_order;

ALTER TABLE public.role ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.role IS 'Application roles; Superadmin receives all active rights implicitly.';
COMMENT ON COLUMN public.role.stamp IS 'Latest action, actor, and timestamp; not a full audit history.';

COMMENT ON TABLE public.app_user IS 'Application login identity; separate from an employee record unless employee_id is supplied.';
COMMENT ON COLUMN public.app_user.email IS 'Stored lowercase and unique; the database rejects non-lowercase values.';
COMMENT ON COLUMN public.app_user.password_hash IS 'Nullable salted password hash only; never store plaintext passwords.';
COMMENT ON COLUMN public.app_user.employee_id IS 'Optional link to EMPLOYEE; SALES.emp_no identifies the seller and is not an app-user identity.';
COMMENT ON COLUMN public.app_user.is_blocked IS 'Blocks sign-in without deleting or revoking the user permission rows.';
COMMENT ON COLUMN public.app_user.must_set_password IS 'When true, the user must set a password before normal sign-in.';
COMMENT ON COLUMN public.app_user.failed_login_count IS 'Failed sign-in attempts used by server-side throttling.';
COMMENT ON COLUMN public.app_user.locked_until IS 'Optional time until which sign-in attempts are locked.';
COMMENT ON COLUMN public.app_user.last_login_at IS 'Timestamp of the last successful sign-in.';
COMMENT ON COLUMN public.app_user.stamp IS 'Latest action, actor, and timestamp; not a full audit history.';

COMMENT ON TABLE public.module IS 'The five application modules used to group permission rights.';
COMMENT ON TABLE public.rights IS 'One catalogue row per permission checkbox.';
COMMENT ON TABLE public.user_permission IS 'One row per user/right pair; revoke by setting status Inactive and re-grant by reactivating the same row.';
COMMENT ON COLUMN public.user_permission.granted_by IS 'Active Admin or Superadmin who most recently granted or reactivated this permission.';
COMMENT ON COLUMN public.user_permission.granted_at IS 'Time this permission was most recently granted or reactivated.';
COMMENT ON COLUMN public.user_permission.stamp IS 'Latest permission action only; earlier grant/revoke history requires a separate audit log.';

COMMENT ON VIEW public.v_user_effective_rights IS 'Effective grants for active users; blocked accounts retain grants and must be denied separately during authentication.';
COMMENT ON VIEW public.v_rights_counts_by_module IS 'Counts active permission checkboxes by active module.';
