import Link from "next/link";
import ListSearch from "@/components/ListSearch";
import { requireRight } from "@/lib/auth/permissions";
import { isManagerRole } from "@/lib/auth/rights-check";
import { loadProducts, productListOptions, type ProductStatusFilter } from "@/lib/products/list";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import "../customers/customers.css";

type SearchParams = { q?: string | string[]; status?: string | string[]; page?: string | string[] };

function productUrl(search: string, status: ProductStatusFilter, page?: number) {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (status !== "Active") params.set("status", status);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/products?${query}` : "/products";
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { snapshot } = await requireRight("products");
  const isManager = isManagerRole(snapshot.role);
  const options = productListOptions(isManager, await searchParams);
  let result;
  try {
    result = await loadProducts(createSupabaseAdminClient(), isManager, options);
  } catch (error) {
    console.error("Product page failed to load.", error);
    return (
      <main className="container customer-page">
        <h1>Product Management</h1>
        <p className="customer-error" role="alert">
          We could not load products. Please try again or contact support.
        </p>
      </main>
    );
  }

  return (
    <main className="container customer-page">
      <header className="customer-heading">
        <div>
          <h1>Product Management</h1>
          <p>Find and manage products.</p>
        </div>
      </header>
      <section className="customer-panel" aria-label="Product list">
        <ListSearch search={options.search} label="Search products" placeholder="Code, description or unit" />
        {result.counts && (
          <nav className="customer-tabs" aria-label="Filter products by status">
            {(["Active", "Inactive", "All"] as const).map((status) => (
              <Link
                key={status}
                href={productUrl(options.search, status)}
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
                <th scope="col">Prod Code</th><th scope="col">Description</th>
                <th scope="col">Unit</th><th scope="col">Current Price</th>
                {isManager && <><th scope="col">Status</th><th scope="col">Stamp</th></>}
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {result.products.map((product) => (
                <tr key={product.prod_code} className={product.status === "Inactive" ? "customer-inactive" : undefined}>
                  <td>{product.prod_code}</td><td>{product.description ?? "—"}</td>
                  <td>{product.unit ?? "—"}</td>
                  <td>{product.current_price == null ? "—" : product.current_price.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  {isManager && (
                    <>
                      <td><span className={`user-status-badge ${product.status === "Active" ? "status-active" : "customer-status-inactive"}`}>{product.status}</span></td>
                      <td>{product.stamp}</td>
                    </>
                  )}
                  <td className="customer-actions">
                    <button disabled title="Prices come in a later task">Prices</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result.products.length === 0 && <p className="customer-empty">No products found.</p>}
        <nav className="customer-pagination" aria-label="Product pages">
          <span>{result.total} {result.total === 1 ? "product" : "products"}</span>
          {options.page > 1 && <Link href={productUrl(options.search, options.status, options.page - 1)}>Previous</Link>}
          <span>Page {options.page}</span>
          {options.page * result.pageSize < result.total && <Link href={productUrl(options.search, options.status, options.page + 1)}>Next</Link>}
        </nav>
      </section>
    </main>
  );
}
