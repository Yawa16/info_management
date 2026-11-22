import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { loadProducts, productListOptions } from "../lib/products/list.ts";

function mockClient(requests) {
  return createClient("https://example.supabase.co", "test-key", {
    auth: { persistSession: false },
    global: {
      fetch: async (url, init) => {
        const request = new URL(url);
        requests.push({ request, method: init.method });
        const status = request.searchParams.get("status");
        const count = status === "eq.Inactive" ? 1 : status === "eq.Active" ? 4 : 5;
        const headers = { "content-range": `0-${count - 1}/${count}`, "content-type": "application/json" };
        if (init.method === "HEAD") return new Response(null, { status: 200, headers });
        return new Response(JSON.stringify([]), { status: 200, headers });
      },
    },
  });
}

test("regular users only query active products and never select status or stamp", async () => {
  const requests = [];
  const options = productListOptions(false, { status: "All" });
  const result = await loadProducts(mockClient(requests), false, { ...options, status: "All" });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].request.searchParams.get("status"), "eq.Active");
  assert.equal(requests[0].request.searchParams.get("select"), "prod_code,description,unit");
  assert.equal(result.counts, null);
});

test("managers get status tabs with counts, metadata, and the Inactive filter", async () => {
  const requests = [];
  const options = productListOptions(true, { status: "Inactive", q: "glove", page: "2" });
  const result = await loadProducts(mockClient(requests), true, options);

  assert.deepEqual(result.counts, { Active: 4, Inactive: 1, All: 5 });
  const rows = requests.find(({ method }) => method === "GET").request;
  assert.equal(rows.searchParams.get("status"), "eq.Inactive");
  assert.match(rows.searchParams.get("select"), /status,stamp/);
  assert.equal(rows.searchParams.get("offset"), "50");
  for (const { request } of requests) {
    assert.equal(request.searchParams.get("or"), '(prod_code.ilike."%glove%",description.ilike."%glove%",unit.ilike."%glove%")');
  }
});

test("non-managers cannot choose a status and search syntax is escaped", async () => {
  assert.equal(productListOptions(false, { status: "Inactive" }).status, "Active");
  const requests = [];
  await loadProducts(mockClient(requests), true, productListOptions(true, { q: 'a",status.eq.Inactive%_\\' }));
  const filter = requests[0].request.searchParams.get("or");
  assert.ok(filter.includes('a\\",status.eq.Inactive\\%\\_\\\\'));
  assert.equal(requests[0].request.searchParams.get("status"), "eq.Active");
});
