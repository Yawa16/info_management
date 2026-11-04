"use client";

import { useActionState } from "react";
import { editManagedUser } from "@/lib/actions/user-management";
import { initialUserManagementActionState } from "@/lib/actions/user-management-types";

type ManagedUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
};

export default function EditManagedUserForm({
  user,
}: {
  user: ManagedUser;
}) {
  const [state, formAction, isPending] = useActionState(
    editManagedUser,
    initialUserManagementActionState,
  );

  return (
    <details className="user-row-edit">
      <summary className="button button-small">Edit</summary>
      <form action={formAction} className="user-management-form">
        <input name="userId" type="hidden" value={user.id} />
        <div className="auth-name-row">
          <div className="auth-field">
            <label htmlFor={`managed-first-name-${user.id}`}>First name</label>
            <input
              autoComplete="given-name"
              defaultValue={user.first_name ?? ""}
              id={`managed-first-name-${user.id}`}
              maxLength={80}
              name="firstName"
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor={`managed-last-name-${user.id}`}>Last name</label>
            <input
              autoComplete="family-name"
              defaultValue={user.last_name ?? ""}
              id={`managed-last-name-${user.id}`}
              maxLength={80}
              name="lastName"
              required
            />
          </div>
        </div>
        <div className="auth-field">
          <label htmlFor={`managed-email-${user.id}`}>Email address</label>
          <input
            autoComplete="email"
            defaultValue={user.email}
            id={`managed-email-${user.id}`}
            maxLength={254}
            name="email"
            required
            type="email"
          />
        </div>
        <button className="button button-small" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
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
      </form>
    </details>
  );
}
