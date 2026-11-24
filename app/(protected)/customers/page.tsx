import Link from "next/link";
import CustomerForm from "@/components/CustomerForm";
import ListSearch from "@/components/ListSearch";
import CustomerStatusButton from "@/components/CustomerStatusButton";
import { requireRight } from "@/lib/auth/permissions";
import { canAccessModule, isManagerRole } from "@/lib/auth/rights-check";
import { customerListOptions, loadCustomers, type CustomerStatusFilter } from "@/lib/customers/list";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import "./customers.css";

type SearchParams = { q?: string | string[]; status?: string | string[]; page?: string | string[] };

function customerUrl(search: string, status: CustomerStatusFilter, page?: number) {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (status !== "Active") params.set("status", status);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/customers?${query}` : "/customers";
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { snapshot } = await requireRight("customers");
  const isManager = isManagerRole(snapshot.role);
  const options = customerListOptions(isManager, await searchParams);
  let result;
  try {
    result = await loadCustomers(createSupabaseAdminClient(), isManager, options);
  } catch (error) {
    console.error("Customer page failed to load.", error);
    return (
      <main className="container customer-page">
        <h1>Customer Management</h1>
        <p className="customer-error" role="alert">
          We could not load customers. Please try again or contact support.
        </p>
      </main>
    );
  }

  const canAdd = canAccessModule(snapshot, "customers", "add");
  const canEdit = canAccessModule(snapshot, "customers", "edit");
  const canDelete = canAccessModule(snapshot, "customers", "delete");

  return (
    <main className="container customer-page">
      <header className="customer-heading">
        <div>
          <h1>Customer Management</h1>
          <p>Find and manage customers.</p>
        </div>
        {canAdd && <CustomerForm />}
      </header>
      <section className="customer-panel" aria-label="Customer list">
        <ListSearch search={options.search} label="Search customers" placeholder="Number, name, address or pay terms" />
        {result.counts && (
          <nav className="customer-tabs" aria-label="Filter customers by status">
            {(["Active", "Inactive", "All"] as const).map((status) => (
              <Link
                key={status}
                href={customerUrl(options.search, status)}
                aria-current={options.status === status ? "page" : undefined}
                className={options.status === status ? "is-current" : undefined}
              >
                {status} ({result.counts![status]})
              </Link>
            ))}
          </nav>
        )}
        <div className="user-table-scroll">
          <table className="user-management-table customer-table">
            <thead>
              <tr>
                <th scope="col">Cust No</th><th scope="col">Customer Name</th>
                <th scope="col">Address</th><th scope="col">Pay Terms</th>
                {isManager && <><th scope="col">Status</th><th scope="col">Stamp</th></>}
                {(canEdit || canDelete || isManager) && <th scope="col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {result.customers.map((customer) => (
                <tr key={customer.cust_no} className={customer.status === "Inactive" ? "customer-inactive" : undefined}>
                  <td>{customer.cust_no}</td><td>{customer.cust_name ?? "—"}</td>
                  <td>{customer.address ?? "—"}</td><td>{customer.pay_terms ?? "—"}</td>
                  {isManager && (
                    <>
                      <td><span className={`user-status-badge ${customer.status === "Active" ? "status-active" : "customer-status-inactive"}`}>{customer.status}</span></td>
                      <td>{customer.stamp}</td>
                    </>
                  )}
                  {(canEdit || canDelete || isManager) && (
                    <td className="customer-actions">
                      {customer.status !== "Inactive" && canEdit && <CustomerForm customer={customer} />}
                      {customer.status !== "Inactive" && canDelete && <CustomerStatusButton customerNumber={customer.cust_no} customerName={customer.cust_name} operation="delete" />}
                      {customer.status === "Inactive" && isManager && <CustomerStatusButton customerNumber={customer.cust_no} customerName={customer.cust_name} operation="restore" />}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result.customers.length === 0 && <p className="customer-empty">No customers found.</p>}
        <nav className="customer-pagination" aria-label="Customer pages">
          <span>{result.total} {result.total === 1 ? "customer" : "customers"}</span>
          {options.page > 1 && <Link href={customerUrl(options.search, options.status, options.page - 1)}>Previous</Link>}
          <span>Page {options.page}</span>
          {options.page * result.pageSize < result.total && <Link href={customerUrl(options.search, options.status, options.page + 1)}>Next</Link>}
        </nav>
      </section>
    </main>
  );
}
