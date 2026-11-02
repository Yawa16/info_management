-- Expected row counts: employee 4, job 4, department 4, jobhistory 2,
-- customer 5, product 5, pricehist 4, sales 4, salesdetail 8, payment 0.
WITH expected_counts (table_name, expected_count) AS (
    VALUES
        ('employee', 4::BIGINT),
        ('job', 4::BIGINT),
        ('department', 4::BIGINT),
        ('jobhistory', 2::BIGINT),
        ('customer', 5::BIGINT),
        ('product', 5::BIGINT),
        ('pricehist', 4::BIGINT),
        ('sales', 4::BIGINT),
        ('salesdetail', 8::BIGINT),
        ('payment', 0::BIGINT)
),
actual_counts (table_name, actual_count) AS (
    SELECT 'employee', COUNT(*) FROM employee
    UNION ALL SELECT 'job', COUNT(*) FROM job
    UNION ALL SELECT 'department', COUNT(*) FROM department
    UNION ALL SELECT 'jobhistory', COUNT(*) FROM jobhistory
    UNION ALL SELECT 'customer', COUNT(*) FROM customer
    UNION ALL SELECT 'product', COUNT(*) FROM product
    UNION ALL SELECT 'pricehist', COUNT(*) FROM pricehist
    UNION ALL SELECT 'sales', COUNT(*) FROM sales
    UNION ALL SELECT 'salesdetail', COUNT(*) FROM salesdetail
    UNION ALL SELECT 'payment', COUNT(*) FROM payment
)
SELECT expected_counts.table_name, expected_count, actual_count,
       actual_count = expected_count AS passed
FROM expected_counts
JOIN actual_counts USING (table_name)
ORDER BY expected_counts.table_name;

-- Expected totals: T-001 = 234.50, T-002 = 140.00, T-003 = 510.00.
WITH expected_totals (trans_no, expected_total) AS (
    VALUES
        ('T-001', 234.50::NUMERIC(12, 2)),
        ('T-002', 140.00::NUMERIC(12, 2)),
        ('T-003', 510.00::NUMERIC(12, 2))
),
actual_totals AS (
    SELECT s.trans_no, SUM(sd.quantity * price.unit_price)::NUMERIC(12, 2) AS actual_total
    FROM sales AS s
    JOIN salesdetail AS sd
      ON sd.trans_no = s.trans_no
     AND sd.status = 'Active'
    JOIN LATERAL (
        SELECT ph.unit_price
        FROM pricehist AS ph
        WHERE ph.prod_code = sd.prod_code
          AND ph.eff_date <= s.sales_date
          AND ph.status = 'Active'
        ORDER BY ph.eff_date DESC
        LIMIT 1
    ) AS price ON TRUE
    WHERE s.status = 'Active'
    GROUP BY s.trans_no
)
SELECT expected_totals.trans_no, expected_total,
       actual_total,
       COALESCE(actual_total, 0) = expected_total AS passed
FROM expected_totals
LEFT JOIN actual_totals USING (trans_no)
ORDER BY expected_totals.trans_no;

-- Expected active-sales sum: 884.50; T-004 is inactive and excluded.
WITH active_sale_totals AS (
    SELECT s.trans_no, SUM(sd.quantity * price.unit_price) AS sale_total
    FROM sales AS s
    JOIN salesdetail AS sd
      ON sd.trans_no = s.trans_no
     AND sd.status = 'Active'
    JOIN LATERAL (
        SELECT ph.unit_price
        FROM pricehist AS ph
        WHERE ph.prod_code = sd.prod_code
          AND ph.eff_date <= s.sales_date
          AND ph.status = 'Active'
        ORDER BY ph.eff_date DESC
        LIMIT 1
    ) AS price ON TRUE
    WHERE s.status = 'Active'
    GROUP BY s.trans_no
)
SELECT 884.50::NUMERIC(12, 2) AS expected_active_sales,
       COALESCE(SUM(sale_total), 0)::NUMERIC(12, 2) AS actual_active_sales,
       COALESCE(SUM(sale_total), 0) = 884.50 AS passed
FROM active_sale_totals;

-- Expected P-003 current price: 28.00.
WITH current_price AS (
    SELECT ph.unit_price AS actual_current_price
    FROM pricehist AS ph
    WHERE ph.prod_code = 'P-003'
      AND ph.eff_date <= CURRENT_DATE
      AND ph.status = 'Active'
    ORDER BY ph.eff_date DESC
    LIMIT 1
)
SELECT 'P-003' AS prod_code,
       28.00::NUMERIC(10, 2) AS expected_current_price,
       actual_current_price,
       COALESCE(actual_current_price = 28.00, FALSE) AS passed
FROM (VALUES (1)) AS expected_row (present)
LEFT JOIN current_price ON TRUE;

-- Expected P-004 current price: none.
SELECT 'P-004' AS prod_code,
       NOT EXISTS (
           SELECT 1
           FROM pricehist AS ph
           WHERE ph.prod_code = 'P-004'
             AND ph.eff_date <= CURRENT_DATE
             AND ph.status = 'Active'
       ) AS has_no_current_price;

-- Expected orphan count: 0 for every foreign key.
SELECT 'jobhistory.emp_no -> employee.emp_no' AS foreign_key, COUNT(*) AS orphan_count
FROM jobhistory AS child
LEFT JOIN employee AS parent ON parent.emp_no = child.emp_no
WHERE child.emp_no IS NOT NULL AND parent.emp_no IS NULL
UNION ALL
SELECT 'jobhistory.job_code -> job.job_code', COUNT(*)
FROM jobhistory AS child
LEFT JOIN job AS parent ON parent.job_code = child.job_code
WHERE child.job_code IS NOT NULL AND parent.job_code IS NULL
UNION ALL
SELECT 'jobhistory.dept_code -> department.dept_code', COUNT(*)
FROM jobhistory AS child
LEFT JOIN department AS parent ON parent.dept_code = child.dept_code
WHERE child.dept_code IS NOT NULL AND parent.dept_code IS NULL
UNION ALL
SELECT 'sales.cust_no -> customer.cust_no', COUNT(*)
FROM sales AS child
LEFT JOIN customer AS parent ON parent.cust_no = child.cust_no
WHERE child.cust_no IS NOT NULL AND parent.cust_no IS NULL
UNION ALL
SELECT 'sales.emp_no -> employee.emp_no', COUNT(*)
FROM sales AS child
LEFT JOIN employee AS parent ON parent.emp_no = child.emp_no
WHERE child.emp_no IS NOT NULL AND parent.emp_no IS NULL
UNION ALL
SELECT 'salesdetail.trans_no -> sales.trans_no', COUNT(*)
FROM salesdetail AS child
LEFT JOIN sales AS parent ON parent.trans_no = child.trans_no
WHERE child.trans_no IS NOT NULL AND parent.trans_no IS NULL
UNION ALL
SELECT 'salesdetail.prod_code -> product.prod_code', COUNT(*)
FROM salesdetail AS child
LEFT JOIN product AS parent ON parent.prod_code = child.prod_code
WHERE child.prod_code IS NOT NULL AND parent.prod_code IS NULL
UNION ALL
SELECT 'payment.trans_no -> sales.trans_no', COUNT(*)
FROM payment AS child
LEFT JOIN sales AS parent ON parent.trans_no = child.trans_no
WHERE child.trans_no IS NOT NULL AND parent.trans_no IS NULL
UNION ALL
SELECT 'pricehist.prod_code -> product.prod_code', COUNT(*)
FROM pricehist AS child
LEFT JOIN product AS parent ON parent.prod_code = child.prod_code
WHERE child.prod_code IS NOT NULL AND parent.prod_code IS NULL
ORDER BY foreign_key;
