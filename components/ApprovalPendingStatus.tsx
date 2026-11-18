"use client";

import { useEffect, useState } from "react";
import { signOutUser } from "@/lib/actions/auth";

type CheckState = "checking" | "pending" | "error" | "rejected" | "blocked";

export default function ApprovalPendingStatus() {
  const [state, setState] = useState<CheckState>("checking");

  useEffect(() => {
    let active = true;

    async function checkStatus() {
      try {
        const response = await fetch("/api/account-status", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Account status request failed (${response.status}).`);
        }

        const result: {
          status: CheckState | "active";
          nextPath?: string;
        } = await response.json();

        if (!active) {
          return;
        }

        if (result.status === "active" && result.nextPath) {
          window.location.replace(result.nextPath);
          return;
        }

        if (result.status === "active") {
          throw new Error("Approved account status is missing its next path.");
        }

        setState(result.status);
      } catch (error) {
        console.error("Unable to refresh account approval status.", error);
        if (active) {
          setState("error");
        }
      }
    }

    void checkStatus();
    const intervalId = window.setInterval(() => {
      void checkStatus();
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  if (state === "rejected" || state === "blocked") {
    return (
      <div className="register-success" role="status">
        <p>
          {state === "rejected"
            ? "Your account request was not approved."
            : "Your account has been blocked."}
        </p>
        <form action={signOutUser}>
          <button className="button button-dark auth-submit" type="submit">
            Sign out
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="register-success" role="status" aria-live="polite">
      <p>
        {state === "error"
          ? "We couldn’t check your approval status right now."
          : state === "checking"
            ? "Checking your approval status…"
            : "Your account is pending approval."}
      </p>
      <span>
        This page checks automatically. When your account is approved, you’ll
        be taken to set your password.
      </span>
    </div>
  );
}
