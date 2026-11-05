"use client";

import { useActionState } from "react";
import {
  createUserWithTemporaryPassword,
  initialCreateUserState,
} from "@/lib/actions/users";

export default function CreateUserForm() {
  const [state, formAction, isPending] = useActionState(
    createUserWithTemporaryPassword,
    initialCreateUserState,
  );

  if (state.status === "success") {
    return (
      <p className="register-success" role="status" aria-live="polite">
        {state.message}
      </p>
    );
  }

  return (
    <form
      className="auth-form"
      action={formAction}
      style={{ maxWidth: "32rem", marginBottom: "2.5rem" }}
    >
      <div className="auth-field">
        <label htmlFor="create-user-first-name">First name</label>
        <input
          autoComplete="given-name"
          id="create-user-first-name"
          maxLength={80}
          name="firstName"
          required
        />
        {state.fieldErrors?.firstName && (
          <span className="register-field-error" role="alert">
            {state.fieldErrors.firstName}
          </span>
        )}
      </div>
      <div className="auth-field">
        <label htmlFor="create-user-last-name">Last name</label>
        <input
          autoComplete="family-name"
          id="create-user-last-name"
          maxLength={80}
          name="lastName"
          required
        />
        {state.fieldErrors?.lastName && (
          <span className="register-field-error" role="alert">
            {state.fieldErrors.lastName}
          </span>
        )}
      </div>
      <div className="auth-field">
        <label htmlFor="create-user-email">Email address</label>
        <input
          autoComplete="email"
          id="create-user-email"
          maxLength={254}
          name="email"
          required
          type="email"
        />
        {state.fieldErrors?.email && (
          <span className="register-field-error" role="alert">
            {state.fieldErrors.email}
          </span>
        )}
      </div>
      <div className="auth-field">
        <label htmlFor="create-user-temporary-password">
          Temporary password
        </label>
        <input
          autoComplete="new-password"
          id="create-user-temporary-password"
          maxLength={128}
          minLength={8}
          name="temporaryPassword"
          required
          type="password"
        />
        {state.fieldErrors?.temporaryPassword && (
          <span className="register-field-error" role="alert">
            {state.fieldErrors.temporaryPassword}
          </span>
        )}
      </div>
      <p className="form-note">
        The account is created as an approved User and must set a new password
        at first sign-in. Share the temporary password securely.
      </p>
      <button
        className="button button-dark auth-submit"
        type="submit"
        disabled={isPending}
      >
        {isPending ? "Creating user…" : "Create user"}
      </button>
      {state.status === "error" && (
        <p className="auth-status" role="alert" aria-live="polite">
          {state.message}
        </p>
      )}
    </form>
  );
}
