"use client";

import { useActionState, useEffect, useRef } from "react";
import { createManagedUser } from "@/lib/actions/user-management";
import { initialUserManagementActionState } from "@/lib/actions/user-management-types";

export default function CreateManagedUserForm() {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [state, formAction, isPending] = useActionState(
    createManagedUser,
    initialUserManagementActionState,
  );

  useEffect(() => {
    if (window.location.hash === "#add-user" && detailsRef.current) {
      detailsRef.current.open = true;
    }
  }, []);

  return (
    <details className="user-add-panel" id="add-user" ref={detailsRef}>
      <summary className="button button-dark">+ Add User</summary>
      <form
        key={`${state.status}-${JSON.stringify(state.values ?? null)}`}
        className="user-management-form"
        action={formAction}
      >
        <h2>Add a User</h2>
        <p>
          A unique temporary password will be generated. The account is active
          immediately, and the user must choose a new password at first sign-in.
        </p>
        <div className="auth-name-row">
          <div className="auth-field">
            <label htmlFor="managed-first-name">First name</label>
            <input
              autoComplete="given-name"
              id="managed-first-name"
              maxLength={80}
              name="firstName"
              defaultValue={state.values?.firstName ?? ""}
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
              defaultValue={state.values?.lastName ?? ""}
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
            defaultValue={state.values?.email ?? ""}
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
