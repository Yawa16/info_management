import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductStatusFilter = "Active" | "Inactive" | "All";

export type Product = {
  prod_code: string;
  description: string | null;
  unit: string | null;
  status?: "Active" | "Inactive";
  stamp?: string;
};

const PAGE_SIZE = 50;
const SEARCH_COLUMNS = ["prod_code", "description", "unit"];

export function productListOptions(
  isManager: boolean,
  params: { q?: string | string[]; status?: string | string[]; page?: string | string[] },
) {
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const status: ProductStatusFilter =
    isManager && (params.status === "Inactive" || params.status === "All")
      ? params.status
      : "Active";
  const parsedPage = typeof params.page === "string" ? Number(params.page) : 1;
  const page =
    Number.isSafeInteger(parsedPage) && parsedPage > 0 && parsedPage <= 100000
      ? parsedPage
      : 1;
  return { search, status, page };
}

function searchFilter(search: string) {
  // Quote PostgREST filter values and escape SQL LIKE wildcards in user input.
  const escaped = search.replace(/\\/g, "\\\\").replace(/[%_*]/g, "\\$&").replace(/"/g, '\\"');
  const pattern = `"%${escaped}%"`;
  return SEARCH_COLUMNS.map((column) => `${column}.ilike.${pattern}`).join(",");
}

export async function loadProducts(
  client: SupabaseClient,
  isManager: boolean,
  options: ReturnType<typeof productListOptions>,
) {
  const { search, page } = options;
  // Do not trust a caller to have normalized the status.
  const status = isManager ? options.status : "Active";
  const filter = search ? searchFilter(search) : null;
  const from = (page - 1) * PAGE_SIZE;
  let rowsQuery = client
    .from("product")
    .select(
      isManager ? "prod_code,description,unit,status,stamp" : "prod_code,description,unit",
      { count: "exact" },
    )
    .order("prod_code")
    .range(from, from + PAGE_SIZE - 1);
  if (status !== "All") rowsQuery = rowsQuery.eq("status", status);
  if (filter) rowsQuery = rowsQuery.or(filter);

  const countStatus = (value: "Active" | "Inactive") => {
    let query = client.from("product").select("prod_code", { count: "exact", head: true }).eq("status", value);
    if (filter) query = query.or(filter);
    return query;
  };

  const [rows, active, inactive] = await Promise.all([
    rowsQuery.overrideTypes<Product[], { merge: false }>(),
    isManager ? countStatus("Active") : Promise.resolve(null),
    isManager ? countStatus("Inactive") : Promise.resolve(null),
  ]);
  const error = rows.error ?? active?.error ?? inactive?.error;
  if (error || rows.count === null || (isManager && (active?.count == null || inactive?.count == null))) {
    console.error("Unable to load Product Management.", {
      code: error?.code,
      message: error?.message ?? "Product count was not returned.",
    });
    throw new Error("Unable to load products.");
  }

  return {
    products: rows.data,
    total: rows.count,
    pageSize: PAGE_SIZE,
    counts: isManager
      ? { Active: active!.count!, Inactive: inactive!.count!, All: active!.count! + inactive!.count! }
      : null,
  };
}
