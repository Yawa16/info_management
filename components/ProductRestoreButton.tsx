"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { restoreProduct } from "@/lib/actions/products";

export default function ProductRestoreButton({
  productCode,
}: {
  productCode: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    setError("");
    startTransition(async () => {
      try {
        const result = await restoreProduct(productCode);
        if (result.status === "error") {
          setError(result.message);
          return;
        }
        router.refresh();
      } catch (requestError) {
        console.error("Product restore request failed.", requestError);
        setError("Could not restore this product. Please try again.");
      }
    });
  }

  return (
    <>
      <button className="customer-status-button" disabled={pending} onClick={submit} type="button">
        {pending ? "Restoring..." : "Restore"}
      </button>
      {error && <span className="customer-error customer-action-error" role="alert">{error}</span>}
    </>
  );
}
