import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function actionHarness({ allowed = true, rpcError = null } = {}) {
  const calls = [];
  const dependencies = {
    "next/cache": { revalidatePath: (path) => calls.push({ revalidate: path }) },
    "@/lib/auth/access": { requireApprovedUser: async () => ({ user: { id: "actor-id" } }) },
    "@/lib/auth/permissions": {
      hasRight: async (_id, module, action) => {
        calls.push({ module, action });
        return allowed;
      },
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
  return { deleteProduct: exports.deleteProduct, calls };
}

test("delete requires PRODUCT_DELETE", async () => {
  const noRight = actionHarness({ allowed: false });
  const deniedDelete = await noRight.deleteProduct("P-001");
  assert.equal(deniedDelete.status, "error");
  assert.match(deniedDelete.message, /permission/);
  assert.equal(noRight.calls[0].action, "delete");
  assert.equal(noRight.calls.some((call) => call.name), false);
});

test("authorized delete calls the soft-delete RPC and refreshes products", async () => {
  const { deleteProduct, calls } = actionHarness();
  const result = await deleteProduct("p-001");
  assert.equal(result.status, "success");
  const rpc = calls.find((call) => call.name);
  assert.equal(rpc.name, "soft_delete_product");
  assert.equal(rpc.args.p_actor_id, "actor-id");
  assert.equal(rpc.args.p_prod_code, "P-001");
  assert.deepEqual(calls.at(-1), { revalidate: "/products" });
});

test("invalid product identifiers and database failures are rejected", async () => {
  const invalid = actionHarness();
  assert.equal((await invalid.deleteProduct("P-001; DROP")).status, "error");
  assert.equal(invalid.calls.some((call) => call.name), false);

  const blocked = actionHarness({
    rpcError: { code: "P0001", message: "Cannot delete product row: 1 active related record(s) still exist." },
  });
  const result = await blocked.deleteProduct("P-001");
  assert.match(result.message, /active sales/);
  assert.equal(blocked.calls.some((call) => call.revalidate), false);
});
