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
        if (request.pathname.endsWith("/pricehist")) {
          return new Response(JSON.stringify([
            { prodcode: "P-001", effdate: "2026-11-20", unitprice: 48.5 },
            { prodcode: "P-001", effdate: "2026-11-10", unitprice: 45 },
          ]), { status: 200, headers: { "content-type": "application/json" } });
        }
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

test("the latest effective active price is attached to each product", async () => {
  const requests = [];
  const client = createClient("https://example.supabase.co", "test-key", {
    auth: { persistSession: false },
    global: {
      fetch: async (url, init) => {
        const request = new URL(url);
        requests.push({ request, method: init.method });
        if (request.pathname.endsWith("/product")) {
          return new Response(JSON.stringify([
            { prod_code: "P-001", description: "Gloves", unit: "pair", status: "Active", stamp: "CREATED test" },
          ]), { status: 200, headers: { "content-range": "0-0/1", "content-type": "application/json" } });
        }
        if (request.pathname.endsWith("/pricehist")) {
          return new Response(JSON.stringify([
            { prodcode: "P-001", effdate: "2026-11-20", unitprice: 48.5 },
            { prodcode: "P-001", effdate: "2026-11-10", unitprice: 45 },
          ]), { status: 200, headers: { "content-type": "application/json" } });
        }
        return new Response(null, { status: 200, headers: { "content-range": "0-0/1" } });
      },
    },
  });

  const result = await loadProducts(client, true, productListOptions(true, {}));

  assert.equal(result.products[0].current_price, 48.5);
  const priceRequest = requests.find(({ request }) => request.pathname.endsWith("/pricehist")).request;
  assert.equal(priceRequest.searchParams.get("is_deleted"), "eq.false");
  assert.equal(priceRequest.searchParams.get("effdate"), `lte.${new Date().toISOString().slice(0, 10)}`);
});
