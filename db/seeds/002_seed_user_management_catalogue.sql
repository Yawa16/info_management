INSERT INTO public.role (name, description, status)
VALUES
    ('Superadmin', 'All rights are granted implicitly; manages administrators.', 'Active'),
    ('Admin', 'Manages application records, users, and user permissions.', 'Active'),
    ('User', 'Receives only explicitly granted rights.', 'Active')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    status = EXCLUDED.status;

INSERT INTO public.module (code, name, sort_order, status)
VALUES
    ('CUSTOMER', 'Customer', 1, 'Active'),
    ('PRODUCT', 'Product', 2, 'Active'),
    ('HUMAN_RESOURCES', 'Human Resources', 3, 'Active'),
    ('SALES', 'Sales', 4, 'Active'),
    ('REPORTS', 'Reports', 5, 'Active')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order,
    status = EXCLUDED.status;

INSERT INTO public.rights (code, module_id, action, label, sort_order, status)
SELECT catalogue.code,
       module.id,
       catalogue.action,
       catalogue.label,
       catalogue.sort_order,
       'Active'
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
ON CONFLICT (code) DO UPDATE
SET module_id = EXCLUDED.module_id,
    action = EXCLUDED.action,
    label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    status = EXCLUDED.status;
