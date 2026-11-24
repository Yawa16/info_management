import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function actionHarness({ role = "admin", rpcError = null } = {}) {
  const calls = [];
  const dependencies = {
    "next/cache": { revalidatePath: (path) => calls.push({ revalidate: path }) },
    "@/lib/auth/access": {
      requireApprovedUser: async () => ({ user: { id: "actor-id" }, role }),
    },
    "@/lib/auth/rights-check": {
      isManagerRole: (candidate) => candidate === "admin" || candidate === "superadmin",
    },
    "@/lib/auth/permissions": { hasRight: async () => true },
    "@/lib/products/form": {
      validateProductForm: () => ({ values: { description: "Test", unit: "pc" } }),
    },
    "@/lib/supabase/admin": {
      createSupabaseAdminClient: () => ({
        rpc: async (name, args) => {
          calls.push({ name, args });
          return { error: rpcError };
        },
      }),
    },
  };
  const source = fs.readFileSync(new URL("../lib/actions/products.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(js, {
    exports,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    console,
  });
  return { restoreProduct: exports.restoreProduct, calls };
}

test("restore is refused for regular Users by the server action", async () => {
  const { restoreProduct, calls } = actionHarness({ role: "user" });
  const result = await restoreProduct("P-001");

  assert.equal(result.status, "error");
  assert.match(result.message, /Admin or Superadmin/);
  assert.equal(calls.some((call) => call.name), false);
});

test("Admins and Superadmins restore through the protected RPC", async () => {
  for (const role of ["admin", "superadmin"]) {
    const { restoreProduct, calls } = actionHarness({ role });
    const result = await restoreProduct("p-001");

    assert.equal(result.status, "success");
    const rpc = calls.find((call) => call.name);
    assert.equal(rpc.name, "restore_product");
    assert.equal(rpc.args.p_actor_id, "actor-id");
    assert.equal(rpc.args.p_prod_code, "P-001");
    assert.deepEqual(calls.at(-1), { revalidate: "/products" });
  }
});

test("invalid product identifiers and RPC failures do not refresh the list", async () => {
  const invalid = actionHarness();
  assert.equal((await invalid.restoreProduct("P-001; DROP")).status, "error");
  assert.equal(invalid.calls.some((call) => call.name), false);

  const failed = actionHarness({ rpcError: { code: "P0001", message: "Database unavailable." } });
  const result = await failed.restoreProduct("P-001");
  assert.equal(result.status, "error");
  assert.equal(failed.calls.some((call) => call.revalidate), false);
});
