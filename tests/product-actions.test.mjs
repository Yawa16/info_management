import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function actionHarness({ allowed = true, role = "user", rpcError = null } = {}) {
  const calls = [];
  const dependencies = {
    "next/cache": { revalidatePath: (path) => calls.push({ revalidate: path }) },
    "@/lib/auth/access": { requireApprovedUser: async () => ({ user: { id: "actor-id" }, role }) },
    "@/lib/auth/permissions": {
      hasRight: async (_id, module, action) => {
        calls.push({ module, action });
        return allowed;
      },
    },
    "@/lib/auth/rights-check": {
      isManagerRole: (value) => value === "admin" || value === "superadmin",
    },
    "@/lib/products/form": { validateProductForm: () => ({ values: { description: "Test", unit: "pc" } }) },
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
  return { changeProductStatus: exports.changeProductStatus, calls };
}

test("delete requires PRODUCT_DELETE and restore is limited to managers", async () => {
  const noRight = actionHarness({ allowed: false });
  const deniedDelete = await noRight.changeProductStatus("P-001", "delete");
  assert.equal(deniedDelete.status, "error");
  assert.match(deniedDelete.message, /permission/);
  assert.equal(noRight.calls[0].action, "delete");
  assert.equal(noRight.calls.some((call) => call.name), false);

  const regularUser = actionHarness({ role: "user" });
  const deniedRestore = await regularUser.changeProductStatus("P-001", "restore");
  assert.match(deniedRestore.message, /Admins or Superadmins/);
  assert.equal(regularUser.calls.some((call) => call.name), false);
});

test("authorized delete and manager restore call the status RPC and refresh products", async () => {
  for (const [role, operation] of [["user", "delete"], ["admin", "restore"], ["superadmin", "restore"]]) {
    const { changeProductStatus, calls } = actionHarness({ role });
    const result = await changeProductStatus("p-001", operation);
    assert.equal(result.status, "success");
    const rpc = calls.find((call) => call.name);
    assert.equal(rpc.name, "change_product_status");
    assert.equal(rpc.args.p_actor_id, "actor-id");
    assert.equal(rpc.args.p_prod_code, "P-001");
    assert.equal(rpc.args.p_operation, operation);
    assert.deepEqual(calls.at(-1), { revalidate: "/products" });
  }
});

test("invalid product identifiers and database failures are rejected", async () => {
  const invalid = actionHarness();
  assert.equal((await invalid.changeProductStatus("P-001; DROP", "delete")).status, "error");
  assert.equal(invalid.calls.some((call) => call.name), false);

  const blocked = actionHarness({
    rpcError: { code: "P0001", message: "Cannot delete product row: 1 active related record(s) still exist." },
  });
  const result = await blocked.changeProductStatus("P-001", "delete");
  assert.match(result.message, /active sales/);
  assert.equal(blocked.calls.some((call) => call.revalidate), false);
});
