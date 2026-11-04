WITH expected (module_code, module_name, expected_count) AS (
    VALUES
        ('CUSTOMER', 'Customer', 3),
        ('PRODUCT', 'Product', 6),
        ('HUMAN_RESOURCES', 'Human Resources', 13),
        ('SALES', 'Sales', 7),
        ('REPORTS', 'Reports', 7)
),
actual AS (
    SELECT module.code AS module_code,
           COUNT(rights.id)::INTEGER AS right_count
    FROM public.module AS module
    LEFT JOIN public.rights AS rights
      ON rights.module_id = module.id
     AND rights.status = 'Active'
    WHERE module.status = 'Active'
    GROUP BY module.code
)
SELECT expected.module_code,
       expected.expected_count,
       COALESCE(actual.right_count, 0) AS actual_count,
       COALESCE(actual.right_count, 0) = expected.expected_count AS passed
FROM expected
LEFT JOIN actual USING (module_code)
ORDER BY expected.module_code;

SELECT COUNT(*) AS active_rights_total,
       COUNT(*) = 36 AS passed
FROM public.rights
WHERE status = 'Active';

SELECT name, status
FROM public.role
WHERE name IN ('Superadmin', 'Admin', 'User')
ORDER BY CASE name
    WHEN 'Superadmin' THEN 1
    WHEN 'Admin' THEN 2
    ELSE 3
END;

DO $$
DECLARE
    role_count INTEGER;
    module_count INTEGER;
    right_count INTEGER;
    per_module_ok BOOLEAN;
BEGIN
    SELECT COUNT(*) INTO role_count
    FROM public.role
    WHERE name IN ('Superadmin', 'Admin', 'User')
      AND status = 'Active';

    SELECT COUNT(*) INTO module_count
    FROM public.module
    WHERE status = 'Active';

    SELECT COUNT(*) INTO right_count
    FROM public.rights
    WHERE status = 'Active';

    WITH expected (module_code, expected_count) AS (
        VALUES
            ('CUSTOMER', 3),
            ('PRODUCT', 6),
            ('HUMAN_RESOURCES', 13),
            ('SALES', 7),
            ('REPORTS', 7)
    ),
    actual AS (
        SELECT module.code AS module_code,
               COUNT(rights.id)::INTEGER AS right_count
        FROM public.module AS module
        LEFT JOIN public.rights AS rights
          ON rights.module_id = module.id
         AND rights.status = 'Active'
        WHERE module.status = 'Active'
        GROUP BY module.code
    )
    SELECT COUNT(*) = 5
       AND BOOL_AND(COALESCE(actual.right_count, 0) = expected.expected_count)
      INTO per_module_ok
    FROM expected
    LEFT JOIN actual USING (module_code);

    IF role_count <> 3 OR module_count <> 5 OR right_count <> 36 OR NOT per_module_ok THEN
        RAISE EXCEPTION
            'Task 5 seed verification failed (active roles %, modules %, rights %, module counts match %).',
            role_count, module_count, right_count, per_module_ok;
    END IF;
END;
$$;
