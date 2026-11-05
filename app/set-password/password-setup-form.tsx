"use client";

import { useActionState } from "react";
import { completePasswordSetup } from "./actions";

type PasswordSetupFormProps = {
  token: string;
};

export function PasswordSetupForm({ token }: PasswordSetupFormProps) {
  const action = completePasswordSetup.bind(null, token);
  const [error, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="mt-7 space-y-5">
      <label className="block text-sm font-medium text-slate-700">
        New password
        <input
          autoComplete="new-password"
          className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-950 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
          maxLength={128}
          minLength={12}
          name="password"
          required
          type="password"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Confirm new password
        <input
          autoComplete="new-password"
          className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-950 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
          maxLength={128}
          minLength={12}
          name="confirmation"
          required
          type="password"
        />
      </label>
      {error ? (
        <p aria-live="polite" className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="w-full rounded-lg bg-teal-800 px-4 py-3 font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Setting password..." : "Set password"}
      </button>
    </form>
  );
}
