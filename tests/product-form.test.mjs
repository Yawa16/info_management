import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { validateProductForm } from "../lib/products/form.ts";

function form(description, unit) {
  const data = new FormData();
  data.set("description", description);
  data.set("unit", unit);
  return data;
}

test("valid product input is trimmed", () => {
  assert.deepEqual(validateProductForm(form("  Gloves  ", "  pair  ")), {
    values: { description: "Gloves", unit: "pair" },
  });
});

test("description and unit are required and bounded", () => {
  assert.match(validateProductForm(form(" ", "pc")).error, /required/);
  assert.match(validateProductForm(form("Gloves", " ")).error, /required/);
  assert.match(validateProductForm(form("x".repeat(201), "pc")).error, /200/);
  assert.match(validateProductForm(form("Gloves", "x".repeat(21))).error, /20/);
});

test("server refuses create without PRODUCT_ADD", async () => {
  const calls = [];
  const deps = {
    "next/cache": { revalidatePath: (path) => calls.push({ revalidate: path }) },
    "@/lib/auth/access": { requireApprovedUser: async () => ({ user: { id: "actor-id" } }) },
    "@/lib/auth/permissions": { hasRight: async () => false },
    "@/lib/products/form": { validateProductForm },
    "@/lib/supabase/admin": { createSupabaseAdminClient: () => ({ rpc: async () => ({ error: null, data: "P-001" }) }) },
  };
  const source = fs.readFileSync(new URL("../lib/actions/products.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(js, {
    exports,
    require: (name) => {
      if (!(name in deps)) throw new Error(`Unexpected dependency: ${name}`);
      return deps[name];
    },
    console,
  });
  const result = await exports.createProduct(form("Gloves", "pair"));
  assert.equal(result.status, "error");
  assert.match(result.message, /permission/);
  assert.equal(calls.length, 0);
});

test("authorized create passes fields to save_product_form and refreshes", async () => {
  const calls = [];
  const deps = {
    "next/cache": { revalidatePath: (path) => calls.push({ revalidate: path }) },
    "@/lib/auth/access": { requireApprovedUser: async () => ({ user: { id: "actor-id" } }) },
    "@/lib/auth/permissions": { hasRight: async () => true },
    "@/lib/products/form": { validateProductForm },
    "@/lib/supabase/admin": { createSupabaseAdminClient: () => ({
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { error: null, data: "P-001" };
      },
    }) },
  };
  const source = fs.readFileSync(new URL("../lib/actions/products.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(js, {
    exports,
    require: (name) => {
      if (!(name in deps)) throw new Error(`Unexpected dependency: ${name}`);
      return deps[name];
    },
    console,
  });
  const result = await exports.createProduct(form("  Gloves  ", "  pair  "));
  assert.equal(result.status, "success");
  assert.equal(result.productCode, "P-001");
  assert.equal(calls[0].name, "save_product_form");
  assert.equal(calls[0].args.p_actor_id, "actor-id");
  assert.equal(calls[0].args.p_description, "Gloves");
  assert.equal(calls[0].args.p_unit, "pair");
  assert.deepEqual(calls.at(-1), { revalidate: "/products" });
});

test("server refuses edit without PRODUCT_EDIT", async () => {
  const calls = [];
  const deps = {
    "next/cache": { revalidatePath: (path) => calls.push({ revalidate: path }) },
    "@/lib/auth/access": { requireApprovedUser: async () => ({ user: { id: "actor-id" } }) },
    "@/lib/auth/permissions": { hasRight: async () => false },
    "@/lib/products/form": { validateProductForm },
    "@/lib/supabase/admin": { createSupabaseAdminClient: () => ({ rpc: async () => ({ error: null }) }) },
  };
  const source = fs.readFileSync(new URL("../lib/actions/products.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(js, {
    exports,
    require: (name) => {
      if (!(name in deps)) throw new Error(`Unexpected dependency: ${name}`);
      return deps[name];
    },
    console,
  });
  const result = await exports.editProduct("P-001", form("Gloves", "pair"));
  assert.equal(result.status, "error");
  assert.match(result.message, /permission/);
  assert.equal(calls.length, 0);
});

test("authorized edit passes locked code and fields to edit_product_form", async () => {
  const calls = [];
  const deps = {
    "next/cache": { revalidatePath: (path) => calls.push({ revalidate: path }) },
    "@/lib/auth/access": { requireApprovedUser: async () => ({ user: { id: "actor-id" } }) },
    "@/lib/auth/permissions": { hasRight: async () => true },
    "@/lib/products/form": { validateProductForm },
    "@/lib/supabase/admin": { createSupabaseAdminClient: () => ({
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { error: null };
      },
    }) },
  };
  const source = fs.readFileSync(new URL("../lib/actions/products.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(js, {
    exports,
    require: (name) => {
      if (!(name in deps)) throw new Error(`Unexpected dependency: ${name}`);
      return deps[name];
    },
    console,
  });
  const result = await exports.editProduct("P-001", form("  Cotton gloves  ", "  pair  "));
  assert.equal(result.status, "success");
  assert.equal(result.productCode, "P-001");
  assert.equal(calls[0].name, "edit_product_form");
  assert.equal(calls[0].args.p_actor_id, "actor-id");
  assert.equal(calls[0].args.p_prod_code, "P-001");
  assert.equal(calls[0].args.p_description, "Cotton gloves");
  assert.equal(calls[0].args.p_unit, "pair");
  assert.deepEqual(calls.at(-1), { revalidate: "/products" });
});
