"use client";

import { useActionState, type FormEvent } from "react";
import {
  approvePendingUser,
  initialApprovalState,
} from "@/lib/actions/users";
import {
  rejectPendingUser,
} from "@/lib/actions/superadmin";
import { initialUserManagementActionState } from "@/lib/actions/user-management-types";

export default function ApproveUserForm({ userId }: { userId: string }) {
  const [state, action, isPending] = useActionState(
    approvePendingUser,
    initialApprovalState,
  );
  const [rejectState, rejectAction, isRejectPending] = useActionState(
    rejectPendingUser,
    initialUserManagementActionState,
  );

  function confirmRejection(event: FormEvent<HTMLFormElement>) {
    if (
      !window.confirm(
        "Reject this registration? The account will no longer be able to access the ERP.",
      )
    ) {
      event.preventDefault();
    }
  }

  return (
    <div className="user-pending-actions">
      <form action={action}>
        <input type="hidden" name="userId" value={userId} />
        <button
          className="button button-small button-dark"
          type="submit"
          disabled={isPending || isRejectPending}
        >
          {isPending ? "Approving…" : "Approve"}
        </button>
        {state.message && (
          <p
            role={state.status === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {state.message}
          </p>
        )}
      </form>
      <form action={rejectAction} onSubmit={confirmRejection}>
        <input type="hidden" name="userId" value={userId} />
        <button
          className="button button-small button-danger"
          type="submit"
          disabled={isPending || isRejectPending}
        >
          {isRejectPending ? "Rejecting…" : "Reject"}
        </button>
        {rejectState.message && (
          <p
            role={rejectState.status === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {rejectState.message}
          </p>
        )}
      </form>
    </div>
  );
}
