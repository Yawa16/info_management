export type ProductFormValues = {
  description: string;
  unit: string;
};

export function validateProductForm(formData: FormData) {
  const description = formData.get("description");
  const unit = formData.get("unit");
  if (typeof description !== "string" || typeof unit !== "string") {
    return { error: "Please fill in the product form." } as const;
  }
  const values = { description: description.trim(), unit: unit.trim() };
  if (!values.description) return { error: "Description is required." } as const;
  if (values.description.length > 200) return { error: "Description must be at most 200 characters." } as const;
  if (!values.unit) return { error: "Unit is required." } as const;
  if (values.unit.length > 20) return { error: "Unit must be at most 20 characters." } as const;
  return { values } as const;
}
