"use client";

import { useActionState } from "react";
import {
  approvePendingUser,
  initialApprovalState,
} from "@/lib/actions/users";

export default function ApproveUserForm({ userId }: { userId: string }) {
  const [state, action, isPending] = useActionState(
    approvePendingUser,
    initialApprovalState,
  );

  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <button
        className="button button-dark"
        type="submit"
        disabled={isPending}
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
  );
}
