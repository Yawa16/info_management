export const PAYMENT_TERMS = ["Net 15", "Net 30", "Net 45", "COD", "Prepaid"] as const;

export type CustomerFormValues = {
  name: string;
  address: string;
  payTerms: string;
};

export function validateCustomerForm(formData: FormData) {
  const name = formData.get("name");
  const address = formData.get("address");
  const payTerms = formData.get("payTerms");
  if (typeof name !== "string" || typeof address !== "string" || typeof payTerms !== "string") {
    return { error: "Please fill in the customer form." } as const;
  }
  const values = { name: name.trim(), address: address.trim(), payTerms };
  if (!values.name) return { error: "Customer Name is required." } as const;
  if (values.name.length > 100) return { error: "Customer Name must be at most 100 characters." } as const;
  if (values.address.length > 200) return { error: "Address must be at most 200 characters." } as const;
  if (values.payTerms && !PAYMENT_TERMS.some((term) => term === values.payTerms)) {
    return { error: "Choose a valid payment term." } as const;
  }
  return { values } as const;
}
