"use client";

import { useActionState } from "react";
import { createManagedUser } from "@/lib/actions/user-management";
import { initialUserManagementActionState } from "@/lib/actions/user-management-types";

export default function CreateManagedUserForm() {
  const [state, formAction, isPending] = useActionState(
    createManagedUser,
    initialUserManagementActionState,
  );

  return (
    <details className="user-add-panel">
      <summary className="button button-dark">+ Add User</summary>
      <form className="user-management-form" action={formAction}>
        <h2>Add a User</h2>
        <p>
          A unique temporary password will be generated. Share it privately;
          the new User must choose a new password after signing in.
        </p>
        <div className="auth-name-row">
          <div className="auth-field">
            <label htmlFor="managed-first-name">First name</label>
            <input
              autoComplete="given-name"
              id="managed-first-name"
              maxLength={80}
              name="firstName"
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="managed-last-name">Last name</label>
            <input
              autoComplete="family-name"
              id="managed-last-name"
              maxLength={80}
              name="lastName"
              required
            />
          </div>
        </div>
        <div className="auth-field">
          <label htmlFor="managed-email">Email address</label>
          <input
            autoComplete="email"
            id="managed-email"
            maxLength={254}
            name="email"
            required
            type="email"
          />
        </div>
        <button className="button button-dark" disabled={isPending}>
          {isPending ? "Creating…" : "Create User"}
        </button>
        {state.message && (
          <p
            className="user-action-message"
            role={state.status === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {state.message}
          </p>
        )}
        {state.status === "success" && state.temporaryPassword && (
          <div className="user-temporary-password">
            <label htmlFor="managed-temporary-password">
              Temporary password (shown once)
            </label>
            <input
              id="managed-temporary-password"
              readOnly
              value={state.temporaryPassword}
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>
        )}
      </form>
    </details>
  );
}
