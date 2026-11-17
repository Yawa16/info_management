CREATE TABLE employee (
    emp_no VARCHAR(10) PRIMARY KEY,
    last_name VARCHAR(50),
    first_name VARCHAR(50),
    gender CHAR(1) CHECK (gender IN ('M', 'F')),
    birth_date DATE,
    hire_date DATE,
    sep_date DATE,
    status VARCHAR(8) NOT NULL DEFAULT 'Active'
        CONSTRAINT employee_status_check CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL,
    CONSTRAINT employee_sep_date_check
        CHECK (sep_date IS NULL OR (hire_date IS NOT NULL AND sep_date >= hire_date))
);

CREATE TABLE job (
    job_code VARCHAR(10) PRIMARY KEY,
    job_desc VARCHAR(50),
    status VARCHAR(8) NOT NULL DEFAULT 'Active'
        CONSTRAINT job_status_check CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL
);

CREATE TABLE department (
    dept_code VARCHAR(10) PRIMARY KEY,
    dept_name VARCHAR(100),
    status VARCHAR(8) NOT NULL DEFAULT 'Active'
        CONSTRAINT department_status_check CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL
);

CREATE TABLE jobhistory (
    emp_no VARCHAR(10) NOT NULL,
    job_code VARCHAR(10) NOT NULL,
    eff_date DATE NOT NULL,
    salary NUMERIC(10, 2) NOT NULL CHECK (salary >= 0),
    dept_code VARCHAR(10),
    status VARCHAR(8) NOT NULL DEFAULT 'Active'
        CONSTRAINT jobhistory_status_check CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL,
    CONSTRAINT jobhistory_pkey PRIMARY KEY (emp_no, job_code, eff_date),
    CONSTRAINT jobhistory_employee_fkey FOREIGN KEY (emp_no)
        REFERENCES employee (emp_no) ON DELETE RESTRICT,
    CONSTRAINT jobhistory_job_fkey FOREIGN KEY (job_code)
        REFERENCES job (job_code) ON DELETE RESTRICT,
    CONSTRAINT jobhistory_department_fkey FOREIGN KEY (dept_code)
        REFERENCES department (dept_code) ON DELETE RESTRICT
);

CREATE TABLE customer (
    cust_no VARCHAR(10) PRIMARY KEY,
    cust_name VARCHAR(100),
    address VARCHAR(200),
    pay_terms VARCHAR(20)
        CHECK (pay_terms IN ('Net 15', 'Net 30', 'Net 45', 'COD', 'Prepaid')),
    status VARCHAR(8) NOT NULL DEFAULT 'Active'
        CONSTRAINT customer_status_check CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL
);

CREATE TABLE product (
    prod_code VARCHAR(10) PRIMARY KEY,
    description VARCHAR(100),
    unit VARCHAR(10) CHECK (unit IN ('pcs', 'can', 'pair', 'meter')),
    status VARCHAR(8) NOT NULL DEFAULT 'Active'
        CONSTRAINT product_status_check CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL
);

CREATE TABLE pricehist (
    prod_code VARCHAR(10) NOT NULL,
    eff_date DATE NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    status VARCHAR(8) NOT NULL DEFAULT 'Active'
        CONSTRAINT pricehist_status_check CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL,
    CONSTRAINT pricehist_pkey PRIMARY KEY (prod_code, eff_date),
    CONSTRAINT pricehist_product_fkey FOREIGN KEY (prod_code)
        REFERENCES product (prod_code) ON DELETE RESTRICT
);

CREATE TABLE sales (
    trans_no VARCHAR(10) PRIMARY KEY,
    sales_date DATE,
    cust_no VARCHAR(10),
    emp_no VARCHAR(10),
    status VARCHAR(8) NOT NULL DEFAULT 'Active'
        CONSTRAINT sales_status_check CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL,
    CONSTRAINT sales_customer_fkey FOREIGN KEY (cust_no)
        REFERENCES customer (cust_no) ON DELETE RESTRICT,
    CONSTRAINT sales_employee_fkey FOREIGN KEY (emp_no)
        REFERENCES employee (emp_no) ON DELETE RESTRICT
);

CREATE TABLE salesdetail (
    trans_no VARCHAR(10) NOT NULL,
    prod_code VARCHAR(10) NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
    status VARCHAR(8) NOT NULL DEFAULT 'Active'
        CONSTRAINT salesdetail_status_check CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL,
    CONSTRAINT salesdetail_pkey PRIMARY KEY (trans_no, prod_code),
    CONSTRAINT salesdetail_sales_fkey FOREIGN KEY (trans_no)
        REFERENCES sales (trans_no) ON DELETE RESTRICT,
    CONSTRAINT salesdetail_product_fkey FOREIGN KEY (prod_code)
        REFERENCES product (prod_code) ON DELETE RESTRICT
);

CREATE TABLE payment (
    or_no VARCHAR(10) PRIMARY KEY,
    pay_date DATE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    trans_no VARCHAR(10),
    status VARCHAR(8) NOT NULL DEFAULT 'Active'
        CONSTRAINT payment_status_check CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL,
    CONSTRAINT payment_sales_fkey FOREIGN KEY (trans_no)
        REFERENCES sales (trans_no) ON DELETE RESTRICT
);

CREATE INDEX employee_status_idx ON employee (status);
CREATE INDEX job_status_idx ON job (status);
CREATE INDEX department_status_idx ON department (status);
CREATE INDEX jobhistory_status_idx ON jobhistory (status);
CREATE INDEX customer_status_idx ON customer (status);
CREATE INDEX product_status_idx ON product (status);
CREATE INDEX pricehist_status_idx ON pricehist (status);
CREATE INDEX sales_status_idx ON sales (status);
CREATE INDEX salesdetail_status_idx ON salesdetail (status);
CREATE INDEX payment_status_idx ON payment (status);

CREATE INDEX jobhistory_employee_idx ON jobhistory (emp_no);
CREATE INDEX jobhistory_job_idx ON jobhistory (job_code);
CREATE INDEX jobhistory_department_idx ON jobhistory (dept_code);
CREATE INDEX sales_customer_idx ON sales (cust_no);
CREATE INDEX sales_employee_idx ON sales (emp_no);
CREATE INDEX salesdetail_sales_idx ON salesdetail (trans_no);
CREATE INDEX salesdetail_product_idx ON salesdetail (prod_code);
CREATE INDEX payment_sales_idx ON payment (trans_no);
CREATE INDEX pricehist_product_idx ON pricehist (prod_code);

ALTER TABLE employee ENABLE ROW LEVEL SECURITY;
ALTER TABLE job ENABLE ROW LEVEL SECURITY;
ALTER TABLE department ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobhistory ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE product ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricehist ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE salesdetail ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE employee IS 'Current and former employees. A separated employee is not necessarily a deleted record.';
COMMENT ON COLUMN employee.sep_date IS 'Date the person left the company; distinct from status, which marks whether this row was soft-deleted.';
COMMENT ON COLUMN employee.status IS 'Record state: Inactive means soft-deleted, not that the employee has left the company.';
COMMENT ON COLUMN employee.stamp IS 'Latest action, actor, and timestamp, for example CREATED system 2026-10-01 9:00 AM.';

COMMENT ON TABLE job IS 'Job titles that may be assigned to employees through jobhistory.';
COMMENT ON COLUMN job.status IS 'Record state: Inactive means soft-deleted.';
COMMENT ON COLUMN job.stamp IS 'Latest action, actor, and timestamp.';

COMMENT ON TABLE department IS 'Organizational departments used by employee job history.';
COMMENT ON COLUMN department.status IS 'Record state: Inactive means soft-deleted.';
COMMENT ON COLUMN department.stamp IS 'Latest action, actor, and timestamp.';

COMMENT ON TABLE jobhistory IS 'Effective-dated job, department, and salary history for an employee.';
COMMENT ON COLUMN jobhistory.eff_date IS 'Date this job-history entry takes effect.';
COMMENT ON COLUMN jobhistory.status IS 'Record state: Inactive means soft-deleted.';
COMMENT ON COLUMN jobhistory.stamp IS 'Latest action, actor, and timestamp.';

COMMENT ON TABLE customer IS 'Customers and their payment terms.';
COMMENT ON COLUMN customer.pay_terms IS 'Agreed payment terms shown in the customer screen, such as Net 30, COD, or Prepaid.';
COMMENT ON COLUMN customer.status IS 'Record state: Inactive means soft-deleted.';
COMMENT ON COLUMN customer.stamp IS 'Latest action, actor, and timestamp.';

COMMENT ON TABLE product IS 'Product catalogue; current prices are derived from pricehist.';
COMMENT ON COLUMN product.status IS 'Record state: Inactive means soft-deleted.';
COMMENT ON COLUMN product.stamp IS 'Latest action, actor, and timestamp.';

COMMENT ON TABLE pricehist IS 'Effective-dated prices; current price is the latest active row not later than the date being queried.';
COMMENT ON COLUMN pricehist.eff_date IS 'Date this product price takes effect.';
COMMENT ON COLUMN pricehist.status IS 'Record state: Inactive means soft-deleted.';
COMMENT ON COLUMN pricehist.stamp IS 'Latest action, actor, and timestamp.';

COMMENT ON TABLE sales IS 'Sale header. The total is derived from active salesdetail rows and pricehist; it is not stored.';
COMMENT ON COLUMN sales.status IS 'Record state: Inactive means soft-deleted.';
COMMENT ON COLUMN sales.stamp IS 'Latest action, actor, and timestamp.';

COMMENT ON TABLE salesdetail IS 'Product and quantity for one sale line; unit price is looked up from pricehist for the sale date.';
COMMENT ON COLUMN salesdetail.status IS 'Record state: Inactive means soft-deleted.';
COMMENT ON COLUMN salesdetail.stamp IS 'Latest action, actor, and timestamp.';

COMMENT ON TABLE payment IS 'Payment receipt linked to a sale.';
COMMENT ON COLUMN payment.status IS 'Record state: Inactive means soft-deleted.';
COMMENT ON COLUMN payment.stamp IS 'Latest action, actor, and timestamp.';
