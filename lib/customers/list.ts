import type { SupabaseClient } from "@supabase/supabase-js";

export type CustomerStatusFilter = "Active" | "Inactive" | "All";

export type Customer = {
  cust_no: string;
  cust_name: string | null;
  address: string | null;
  pay_terms: string | null;
  status?: "Active" | "Inactive";
  stamp?: string;
};

const PAGE_SIZE = 50;

export function customerListOptions(
  isManager: boolean,
  params: { q?: string | string[]; status?: string | string[]; page?: string | string[] },
) {
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const status: CustomerStatusFilter =
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
  return ["cust_no", "cust_name", "address", "pay_terms"]
    .map((column) => `${column}.ilike.${pattern}`)
    .join(",");
}

export async function loadCustomers(
  client: SupabaseClient,
  isManager: boolean,
  options: ReturnType<typeof customerListOptions>,
) {
  const { search, page } = options;
  // Do not trust a caller to have normalized the status.
  const status = isManager ? options.status : "Active";
  const filter = search ? searchFilter(search) : null;
  const from = (page - 1) * PAGE_SIZE;
  let rowsQuery = client
    .from("customer")
    .select(
      isManager
        ? "cust_no,cust_name,address,pay_terms,status,stamp"
        : "cust_no,cust_name,address,pay_terms",
      { count: "exact" },
    )
    .order("cust_no")
    .range(from, from + PAGE_SIZE - 1);
  if (status !== "All") rowsQuery = rowsQuery.eq("status", status);
  if (filter) rowsQuery = rowsQuery.or(filter);

  const countStatus = (value: "Active" | "Inactive") => {
    let query = client.from("customer").select("cust_no", { count: "exact", head: true }).eq("status", value);
    if (filter) query = query.or(filter);
    return query;
  };

  const [rows, active, inactive] = await Promise.all([
    rowsQuery.overrideTypes<Customer[], { merge: false }>(),
    isManager ? countStatus("Active") : Promise.resolve(null),
    isManager ? countStatus("Inactive") : Promise.resolve(null),
  ]);
  const error = rows.error ?? active?.error ?? inactive?.error;
  if (error || rows.count === null || (isManager && (active?.count == null || inactive?.count == null))) {
    console.error("Unable to load Customer Management.", {
      code: error?.code,
      message: error?.message ?? "Customer count was not returned.",
    });
    throw new Error("Unable to load customers.");
  }

  return {
    customers: rows.data,
    total: rows.count,
    pageSize: PAGE_SIZE,
    counts: isManager
      ? { Active: active!.count!, Inactive: inactive!.count!, All: active!.count! + inactive!.count! }
      : null,
  };
}
