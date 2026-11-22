"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedUser } from "@/lib/auth/access";
import { hasRight } from "@/lib/auth/permissions";
import { validateProductForm } from "@/lib/products/form";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ProductSaveResult = { status: "success"; productCode: string } | { status: "error"; message: string };

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
