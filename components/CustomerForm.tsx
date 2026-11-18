"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCustomer } from "@/lib/actions/customers";
import { PAYMENT_TERMS } from "@/lib/customers/form";
import type { Customer } from "@/lib/customers/list";

export default function CustomerForm({ customer }: { customer?: Customer }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const existingTerms = customer?.pay_terms ?? "";
  const isLegacyTerm = Boolean(existingTerms && !PAYMENT_TERMS.some((term) => term === existingTerms));

  function open() {
    setError("");
    dialog.current?.showModal();
  }

  function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      try {
        const result = await saveCustomer(customer?.cust_no ?? null, formData);
        if (result.status === "error") {
          setError(result.message);
          return;
        }
        dialog.current?.close();
        router.refresh();
      } catch (error) {
        console.error("Customer save request failed.", error);
        setError("Could not save this customer. Please try again.");
      }
    });
  }

  return (
    <>
      <button className={customer ? "customer-edit" : "customer-add"} onClick={open} type="button">
        {customer ? "Edit" : "+ Add Customer"}
      </button>
      <dialog
        aria-labelledby={titleId}
        className="customer-dialog"
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        ref={dialog}
      >
        <form action={submit} className="customer-form">
          <header className="customer-dialog-header">
            <h2 id={titleId}>{customer ? "Edit Customer" : "Add Customer"}</h2>
            <button aria-label="Close" disabled={pending} onClick={() => dialog.current?.close()} type="button">×</button>
          </header>
          <label>
            Customer Number
            <input readOnly value={customer?.cust_no ?? "Assigned automatically"} />
          </label>
          <label>
            Customer Name
            <input defaultValue={customer?.cust_name ?? ""} maxLength={100} name="name" required />
          </label>
          <label>
            Address
            <input defaultValue={customer?.address ?? ""} maxLength={200} name="address" />
          </label>
          <label>
            Pay Terms
            <select defaultValue={existingTerms} name="payTerms">
              <option value="">Not specified</option>
              {isLegacyTerm && <option disabled value={existingTerms}>{existingTerms} (choose a valid term)</option>}
              {PAYMENT_TERMS.map((term) => <option key={term} value={term}>{term}</option>)}
            </select>
          </label>
          {isLegacyTerm && <p className="customer-error">Choose a supported pay term or Not specified before saving.</p>}
          {error && <p className="customer-error" role="alert">{error}</p>}
          <footer className="customer-dialog-footer">
            <button disabled={pending} onClick={() => dialog.current?.close()} type="button">Cancel</button>
            <button className="customer-add" disabled={pending} type="submit">{pending ? "Saving…" : "Save"}</button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
