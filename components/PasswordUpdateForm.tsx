"use client";

import { useActionState } from "react";
import { updatePassword } from "@/lib/actions/auth";
import { initialPasswordUpdateState } from "@/lib/actions/auth-types";

export default function PasswordUpdateForm() {
  const [state, formAction, isPending] = useActionState(
    updatePassword,
    initialPasswordUpdateState,
  );

  return (
    <form className="auth-form" action={formAction}>
      <div className="auth-field">
        <label htmlFor="password">New password</label>
        <input
          autoComplete="new-password"
          id="password"
          maxLength={128}
          minLength={8}
          name="password"
          placeholder="At least 8 characters"
          required
          type="password"
        />
      </div>
      <div className="auth-field">
        <label htmlFor="confirmPassword">Confirm new password</label>
        <input
          autoComplete="new-password"
          id="confirmPassword"
          maxLength={128}
          minLength={8}
          name="confirmPassword"
          placeholder="Re-enter your new password"
          required
          type="password"
        />
      </div>
      <button className="button button-dark auth-submit" disabled={isPending}>
        {isPending ? "Updating…" : "Update Password"}
      </button>
      <p
        className="auth-status"
        role={state.status === "error" ? "alert" : undefined}
        aria-live="polite"
      >
        {state.message}
      </p>
    </form>
  );
}
