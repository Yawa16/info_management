"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProduct, editProduct } from "@/lib/actions/products";
import type { Product } from "@/lib/products/list";

export default function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function open() {
    setError("");
    dialog.current?.showModal();
  }

  function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      try {
        const result = product
          ? await editProduct(product.prod_code, formData)
          : await createProduct(formData);
        if (result.status === "error") {
          setError(result.message);
          return;
        }
        dialog.current?.close();
        router.refresh();
      } catch (saveError) {
        console.error("Product save request failed.", saveError);
        setError(product ? "Could not edit this product. Please try again." : "Could not create this product. Please try again.");
      }
    });
  }

  return (
    <>
      <button className={product ? "customer-edit" : "customer-add"} onClick={open} type="button">
        {product ? "Edit" : "+ Add Product"}
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
            <h2 id={titleId}>{product ? "Edit Product" : "Add Product"}</h2>
            <button aria-label="Close" disabled={pending} onClick={() => dialog.current?.close()} type="button">×</button>
          </header>
          <label>
            Prod Code
            <input readOnly value={product?.prod_code ?? "Assigned automatically"} />
          </label>
          <label>
            Description
            <input defaultValue={product?.description ?? ""} maxLength={200} name="description" required />
          </label>
          <label>
            Unit
            <input defaultValue={product?.unit ?? ""} maxLength={20} name="unit" placeholder="pcs, can, pair, meter" required />
          </label>
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
