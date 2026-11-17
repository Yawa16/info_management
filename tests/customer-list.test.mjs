import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { customerListOptions, loadCustomers } from "../lib/customers/list.ts";

function mockClient(requests) {
  return createClient("https://example.supabase.co", "test-key", {
    auth: { persistSession: false },
    global: {
      fetch: async (url, init) => {
        const request = new URL(url);
        requests.push({ request, method: init.method });
        const status = request.searchParams.get("status");
        const count = status === "eq.Inactive" ? 1 : status === "eq.Active" ? 2 : 3;
        const headers = { "content-range": `0-${count - 1}/${count}`, "content-type": "application/json" };
        if (init.method === "HEAD") return new Response(null, { status: 200, headers });
        return new Response(JSON.stringify([]), { status: 200, headers });
      },
    },
  });
}

test("regular users are restricted in the database query even with an All URL", async () => {
  const requests = [];
  const options = customerListOptions(false, { status: "All" });
  const result = await loadCustomers(mockClient(requests), false, { ...options, status: "All" });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].request.searchParams.get("status"), "eq.Active");
  assert.equal(requests[0].request.searchParams.get("select"), "cust_no,cust_name,address,pay_terms");
  assert.equal(result.counts, null);
});

test("manager status tabs count filtered rows and display inactive metadata", async () => {
  const requests = [];
  const options = customerListOptions(true, { status: "Inactive", q: "Net 30", page: "2" });
  const result = await loadCustomers(mockClient(requests), true, options);

  assert.deepEqual(result.counts, { Active: 2, Inactive: 1, All: 3 });
  const rows = requests.find(({ method }) => method === "GET").request;
  assert.equal(rows.searchParams.get("status"), "eq.Inactive");
  assert.match(rows.searchParams.get("select"), /status,stamp/);
  assert.equal(rows.searchParams.get("offset"), "50");
  for (const { request } of requests) {
    assert.equal(request.searchParams.get("or"), '(cust_no.ilike."%Net 30%",cust_name.ilike."%Net 30%",address.ilike."%Net 30%",pay_terms.ilike."%Net 30%")');
  }
});

test("search syntax is quoted and LIKE wildcards in input are escaped", async () => {
  const requests = [];
  const options = customerListOptions(true, { q: 'a",status.eq.Inactive%_\\' });
  await loadCustomers(mockClient(requests), true, options);
  const filter = requests[0].request.searchParams.get("or");
  assert.ok(filter.includes('a\\",status.eq.Inactive\\%\\_\\\\'));
  assert.equal(requests[0].request.searchParams.get("status"), "eq.Active");
});
