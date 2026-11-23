"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeProductStatus } from "@/lib/actions/products";

export default function ProductStatusButton({
  productCode,
  description,
  operation,
}: {
  productCode: string;
  description: string | null;
  operation: "delete" | "restore";
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (
      operation === "delete" &&
      !window.confirm(
        `Delete ${description || productCode} (${productCode})? Its price history will be kept. An Admin or Superadmin can restore it later.`,
      )
    ) {
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        const result = await changeProductStatus(productCode, operation);
        if (result.status === "error") {
          setError(result.message);
          return;
        }
        router.refresh();
      } catch (requestError) {
        console.error("Product status request failed.", requestError);
        setError("Could not update this product. Please try again.");
      }
    });
  }

  return (
    <>
      <button className="customer-status-button" disabled={pending} onClick={submit} type="button">
        {pending ? "Saving…" : operation === "delete" ? "Delete" : "Restore"}
      </button>
      {error && <span className="customer-error customer-action-error" role="alert">{error}</span>}
    </>
  );
}
