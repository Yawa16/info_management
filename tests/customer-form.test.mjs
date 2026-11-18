import assert from "node:assert/strict";
import test from "node:test";
import { validateCustomerForm } from "../lib/customers/form.ts";

function form(name, address, payTerms) {
  const data = new FormData();
  data.set("name", name);
  data.set("address", address);
  data.set("payTerms", payTerms);
  return data;
}

test("valid customer input is trimmed and optional fields are accepted", () => {
  assert.deepEqual(validateCustomerForm(form("  Jane  ", "  Street  ", "Net 30")), {
    values: { name: "Jane", address: "Street", payTerms: "Net 30" },
  });
  assert.deepEqual(validateCustomerForm(form("Jane", "", "")), {
    values: { name: "Jane", address: "", payTerms: "" },
  });
});

test("server validation rejects missing names, long fields, and invalid terms", () => {
  assert.match(validateCustomerForm(form("  ", "", "")).error, /required/);
  assert.match(validateCustomerForm(form("x".repeat(101), "", "")).error, /100/);
  assert.match(validateCustomerForm(form("Jane", "x".repeat(201), "")).error, /200/);
  assert.match(validateCustomerForm(form("Jane", "", "Net 60")).error, /valid payment/);
});

test("server validation rejects missing or non-text form values", () => {
  assert.match(validateCustomerForm(new FormData()).error, /customer form/);
  const data = form("Jane", "", "COD");
  data.set("name", new File(["Jane"], "name.txt"));
  assert.match(validateCustomerForm(data).error, /customer form/);
});
