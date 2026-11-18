"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeCustomerStatus } from "@/lib/actions/customers";

export default function CustomerStatusButton({
  customerNumber,
  customerName,
  operation,
}: {
  customerNumber: string;
  customerName: string | null;
  operation: "delete" | "restore";
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (operation === "delete" &&
      !window.confirm(`Delete ${customerName || customerNumber} (${customerNumber})? An Admin can restore this customer later.`)) {
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        const result = await changeCustomerStatus(customerNumber, operation);
        if (result.status === "error") {
          setError(result.message);
          return;
        }
        router.refresh();
      } catch (requestError) {
        console.error("Customer status request failed.", requestError);
        setError("Could not update this customer. Please try again.");
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
