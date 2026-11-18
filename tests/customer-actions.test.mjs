import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { validateCustomerForm } from "../lib/customers/form.ts";

function actionHarness(allowed) {
  const calls = [];
  const dependencies = {
    "next/cache": { revalidatePath: (path) => calls.push({ revalidate: path }) },
    "@/lib/auth/access": { requireApprovedUser: async () => ({ user: { id: "actor-id" } }) },
    "@/lib/auth/permissions": { hasRight: async (_id, module, action) => {
      calls.push({ module, action });
      return allowed;
    } },
    "@/lib/customers/form": { validateCustomerForm },
    "@/lib/supabase/admin": { createSupabaseAdminClient: () => ({
      rpc: async (name, args) => { calls.push({ name, args }); return { error: null }; },
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
  return { saveCustomer: exports.saveCustomer, calls };
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
