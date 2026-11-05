"use client";

import { useActionState, type FormEvent } from "react";
import { setManagedUserRole } from "@/lib/actions/superadmin";
import { initialUserManagementActionState } from "@/lib/actions/user-management-types";

export default function ManageUserRoleForm({
  userId,
  role,
}: {
  userId: string;
  role: "admin" | "user";
}) {
  const nextRole = role === "user" ? "admin" : "user";
  const [state, formAction, isPending] = useActionState(
    setManagedUserRole,
    initialUserManagementActionState,
  );

  function confirmDemotion(event: FormEvent<HTMLFormElement>) {
    if (
      nextRole === "user" &&
      !window.confirm("Demote this Admin to a regular User?")
    ) {
      event.preventDefault();
    }
  }

  return (
    <form action={formAction} onSubmit={confirmDemotion}>
      <input name="userId" type="hidden" value={userId} />
      <input name="role" type="hidden" value={nextRole} />
      <button className="button button-small" disabled={isPending}>
        {isPending
          ? "Saving…"
          : nextRole === "admin"
            ? "Make Admin"
            : "Make User"}
      </button>
      {state.status === "error" && state.message && (
        <span
          className="user-action-message"
          role="alert"
          aria-live="polite"
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
