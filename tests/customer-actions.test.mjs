import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { validateCustomerForm } from "../lib/customers/form.ts";

function actionHarness(allowed, { role = "user", rpcError = null } = {}) {
  const calls = [];
  const dependencies = {
    "next/cache": { revalidatePath: (path) => calls.push({ revalidate: path }) },
    "@/lib/auth/access": { requireApprovedUser: async () => ({ user: { id: "actor-id" }, role }) },
    "@/lib/auth/permissions": { hasRight: async (_id, module, action) => {
      calls.push({ module, action });
      return allowed;
    } },
    "@/lib/customers/form": { validateCustomerForm },
    "@/lib/auth/rights-check": { isManagerRole: (value) => value === "admin" || value === "superadmin" },
    "@/lib/supabase/admin": { createSupabaseAdminClient: () => ({
      rpc: async (name, args) => { calls.push({ name, args }); return { error: rpcError }; },
    }) },
  };
  const source = fs.readFileSync(new URL("../lib/actions/customers.ts", import.meta.url), "utf8");
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
  return { saveCustomer: exports.saveCustomer, changeCustomerStatus: exports.changeCustomerStatus, calls };
}

function validForm() {
  const form = new FormData();
  form.set("name", "Customer");
  form.set("address", "");
  form.set("payTerms", "COD");
  return form;
}

test("server refuses create and edit without the corresponding right", async () => {
  for (const [number, action] of [[null, "add"], ["A-001", "edit"]]) {
    const { saveCustomer, calls } = actionHarness(false);
    const result = await saveCustomer(number, validForm());
    assert.equal(result.status, "error");
    assert.match(result.message, /permission/);
    assert.equal(calls[0].action, action);
    assert.equal(calls.some((call) => call.name), false);
  }
});

test("server passes its authenticated actor and validated fields to the RPC", async () => {
  const { saveCustomer, calls } = actionHarness(true);
  const result = await saveCustomer("A-001", validForm());
  assert.equal(result.status, "success");
  const rpc = calls.find((call) => call.name);
  assert.equal(rpc.name, "save_customer_form");
  assert.equal(rpc.args.p_actor_id, "actor-id");
  assert.equal(rpc.args.p_cust_no, "A-001");
  assert.equal(rpc.args.p_pay_terms, "COD");
  assert.equal(calls.at(-1).revalidate, "/customers");
});

test("invalid submitted fields never reach the database", async () => {
  const { saveCustomer, calls } = actionHarness(true);
  const form = validForm();
  form.set("payTerms", "Net 60");
  const result = await saveCustomer(null, form);
  assert.equal(result.status, "error");
  assert.match(result.message, /valid payment/);
  assert.equal(calls.some((call) => call.name), false);
});

test("delete requires the right and restore requires a manager", async () => {
  const noDelete = actionHarness(false);
  const deniedDelete = await noDelete.changeCustomerStatus("C-001", "delete");
  assert.match(deniedDelete.message, /permission/);
  assert.equal(noDelete.calls[0].action, "delete");
  assert.equal(noDelete.calls.some((call) => call.name), false);

  const regularUser = actionHarness(true);
  const deniedRestore = await regularUser.changeCustomerStatus("C-001", "restore");
  assert.match(deniedRestore.message, /Admin or Superadmin/);
  assert.equal(regularUser.calls.some((call) => call.name), false);
});

test("authorized transitions use the authenticated actor and refresh the list", async () => {
  for (const [role, operation] of [["user", "delete"], ["admin", "restore"], ["superadmin", "restore"]]) {
    const { changeCustomerStatus, calls } = actionHarness(true, { role });
    const result = await changeCustomerStatus("C-001", operation);
    assert.equal(result.status, "success");
    const rpc = calls.find((call) => call.name);
    assert.equal(rpc.name, "change_customer_status");
    assert.equal(rpc.args.p_actor_id, "actor-id");
    assert.equal(rpc.args.p_cust_no, "C-001");
    assert.equal(rpc.args.p_operation, operation);
    assert.equal(calls.at(-1).revalidate, "/customers");
  }
});

test("invalid status actions are rejected without a database call", async () => {
  for (const [number, operation] of [["", "delete"], ["C-001", "other"]]) {
    const { changeCustomerStatus, calls } = actionHarness(true);
    assert.equal((await changeCustomerStatus(number, operation)).status, "error");
    assert.equal(calls.some((call) => call.name), false);
  }
});

test("database failures do not refresh and the active-sales restriction is explained", async () => {
  const { changeCustomerStatus, calls } = actionHarness(true, {
    rpcError: { code: "P0001", message: "Cannot delete customer row: 1 active related record(s) still exist." },
  });
  const result = await changeCustomerStatus("C-001", "delete");
  assert.match(result.message, /active sales/);
  assert.equal(calls.some((call) => call.revalidate), false);
});
