"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedUser } from "@/lib/auth/access";
import { hasRight } from "@/lib/auth/permissions";
import { validateCustomerForm } from "@/lib/customers/form";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type CustomerSaveResult = { status: "success" } | { status: "error"; message: string };

export async function saveCustomer(
  customerNumber: string | null,
  formData: FormData,
): Promise<CustomerSaveResult> {
  const { user } = await requireApprovedUser();
  if (customerNumber !== null && (typeof customerNumber !== "string" || !customerNumber.trim() || customerNumber.length > 10)) {
    return { status: "error", message: "Invalid customer number." };
  }
  const action = customerNumber === null ? "add" : "edit";
  if (!(await hasRight(user.id, "customers", action))) {
    return { status: "error", message: "You do not have permission to save this customer." };
  }

  const validation = validateCustomerForm(formData);
  if (validation.error !== undefined) return { status: "error", message: validation.error };

  const { error } = await createSupabaseAdminClient().rpc("save_customer_form", {
    p_actor_id: user.id,
    p_cust_no: customerNumber,
    p_name: validation.values.name,
    p_address: validation.values.address || null,
    p_pay_terms: validation.values.payTerms || null,
  });
  if (error) {
    console.error("Unable to save customer.", { code: error.code, message: error.message });
    return { status: "error", message: "Could not save this customer. It may have changed or become inactive. Please refresh and try again." };
  }
  revalidatePath("/customers");
  return { status: "success" };
}
