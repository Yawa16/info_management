"use client";

import { useActionState, type FormEvent } from "react";
import { setManagedUserBlocked } from "@/lib/actions/user-management";
import { initialUserManagementActionState } from "@/lib/actions/user-management-types";

export default function BlockManagedUserForm({
  userId,
  isBlocked,
}: {
  userId: string;
  isBlocked: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    setManagedUserBlocked,
    initialUserManagementActionState,
  );

  function confirmChange(event: FormEvent<HTMLFormElement>) {
    const message = isBlocked
      ? "Unblock this account so it can sign in again?"
      : "Block this account? It will no longer be able to sign in or access protected pages.";
    if (!window.confirm(message)) {
      event.preventDefault();
    }
  }

  return (
    <form action={formAction} onSubmit={confirmChange}>
      <input name="userId" type="hidden" value={userId} />
      <input name="blocked" type="hidden" value={String(!isBlocked)} />
      <button className="button button-small" disabled={isPending}>
        {isPending ? "Saving…" : isBlocked ? "Unblock" : "Block"}
      </button>
      {state.message && (
        <span
          className="user-action-message"
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
