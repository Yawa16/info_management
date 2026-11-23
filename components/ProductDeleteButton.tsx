"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProduct } from "@/lib/actions/products";

export default function ProductDeleteButton({
  productCode,
  description,
}: {
  productCode: string;
  description: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (
      !window.confirm(
        `Delete ${description || productCode} (${productCode})? This marks it inactive and keeps its price history.`,
      )
    ) {
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        const result = await deleteProduct(productCode);
        if (result.status === "error") {
          setError(result.message);
          return;
        }
        router.refresh();
      } catch (requestError) {
        console.error("Product deletion request failed.", requestError);
        setError("Could not delete this product. Please try again.");
      }
    });
  }

  return (
    <>
      <button className="customer-status-button" disabled={pending} onClick={submit} type="button">
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && <span className="customer-error customer-action-error" role="alert">{error}</span>}
    </>
  );
}
