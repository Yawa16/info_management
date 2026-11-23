"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedUser } from "@/lib/auth/access";
import { hasRight } from "@/lib/auth/permissions";
import { isManagerRole } from "@/lib/auth/rights-check";
import { validateProductForm } from "@/lib/products/form";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ProductSaveResult = { status: "success"; productCode: string } | { status: "error"; message: string };
export type ProductStatusResult = { status: "success" } | { status: "error"; message: string };

export async function createProduct(formData: FormData): Promise<ProductSaveResult> {
  const { user } = await requireApprovedUser();
  if (!(await hasRight(user.id, "products", "add"))) {
    return { status: "error", message: "You do not have permission to add products." };
  }

  const validation = validateProductForm(formData);
  if (validation.error !== undefined) return { status: "error", message: validation.error };

  const { data, error } = await createSupabaseAdminClient().rpc("save_product_form", {
    p_actor_id: user.id,
    p_description: validation.values.description,
    p_unit: validation.values.unit,
  });
  if (error) {
    console.error("Unable to create product.", { code: error.code, message: error.message });
    return { status: "error", message: "Could not create this product. Please try again." };
  }
  revalidatePath("/products");
  return { status: "success", productCode: data as string };
}

export async function editProduct(
  productCode: string,
  formData: FormData,
): Promise<ProductSaveResult> {
  const { user } = await requireApprovedUser();
  if (typeof productCode !== "string" || !/^P-[0-9]{1,8}$/i.test(productCode)) {
    return { status: "error", message: "Invalid product code." };
  }
  if (!(await hasRight(user.id, "products", "edit"))) {
    return { status: "error", message: "You do not have permission to edit products." };
  }

  const validation = validateProductForm(formData);
  if (validation.error !== undefined) return { status: "error", message: validation.error };

  const { error } = await createSupabaseAdminClient().rpc("edit_product_form", {
    p_actor_id: user.id,
    p_prod_code: productCode.toUpperCase(),
    p_description: validation.values.description,
    p_unit: validation.values.unit,
  });
  if (error) {
    console.error("Unable to edit product.", { code: error.code, message: error.message });
    return { status: "error", message: "Could not edit this product. Please try again." };
  }
  revalidatePath("/products");
  return { status: "success", productCode: productCode.toUpperCase() };
}

export async function changeProductStatus(
  productCode: string,
  operation: "delete" | "restore",
): Promise<ProductStatusResult> {
  const { user, role } = await requireApprovedUser();
  if (typeof productCode !== "string" || !/^P-[0-9]{1,8}$/i.test(productCode)) {
    return { status: "error", message: "Invalid product code." };
  }
  if (operation !== "delete" && operation !== "restore") {
    return { status: "error", message: "Invalid product status action." };
  }
  if (operation === "restore" && !isManagerRole(role)) {
    return { status: "error", message: "Only Admins or Superadmins can restore products." };
  }
  if (operation === "delete" && !(await hasRight(user.id, "products", "delete"))) {
    return { status: "error", message: "You do not have permission to delete products." };
  }

  const { error } = await createSupabaseAdminClient().rpc("change_product_status", {
    p_actor_id: user.id,
    p_prod_code: productCode.toUpperCase(),
    p_operation: operation,
  });
  if (error) {
    console.error("Unable to change product status.", { code: error.code, message: error.message });
    if (error.message.startsWith("Cannot delete product row:")) {
      return { status: "error", message: "This product cannot be deleted while active sales are linked to it." };
    }
    return { status: "error", message: "Could not update this product. Please try again." };
  }
  revalidatePath("/products");
  return { status: "success" };
}
