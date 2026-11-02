"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export type AuthMode = "login" | "register" | "reset" | "update";

type AuthContent = {
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  footer: ReactNode;
};

const content: Record<AuthMode, AuthContent> = {
  login: {
    eyebrow: "WELCOME BACK",
    title: "Good to see you.",
    description: "Log in to pick up right where your team left off.",
    action: "Log in to Hope",
    footer: (
      <>
        New to Hope? <Link href="/register">Create an account</Link>
      </>
    ),
  },
  register: {
    eyebrow: "REQUEST ACCESS",
    title: "Register",
    description:
      "Request access to Hope. A Superadmin must approve new accounts.",
    action: "Register",
    footer: (
      <>
        Already have an account? <Link href="/sign-in">Log in</Link>
      </>
    ),
  },
  reset: {
    eyebrow: "WE'VE GOT YOU",
    title: "Let's get you back in.",
    description:
      "Enter the email address you used to sign up and we’ll help you reset your password.",
    action: "Send reset link",
    footer: (
      <>
        Remembered your password? <Link href="/sign-in">Back to log in</Link>
      </>
    ),
  },
  update: {
    eyebrow: "ALMOST THERE",
    title: "Choose a new password.",
    description: "Use at least 8 characters for your new password.",
    action: "Save new password",
    footer: (
      <>
        <Link href="/sign-in">Back to log in</Link>
      </>
    ),
  },
};

function getErrorMessage(message: string, mode: AuthMode) {
  const normalized = message.toLowerCase();

  if (
    mode === "login" &&
    (normalized.includes("invalid login credentials") ||
      normalized.includes("user not found"))
  ) {
    return "We couldn’t sign you in with those details. Check your email and password, then try again.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Please confirm your email address using the link we sent before signing in.";
  }

  if (normalized.includes("rate limit")) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  return message;
}

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<{
    tone: "error" | "success" | "info";
    text: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const current = content[mode];
  const isReset = mode === "reset";
  const isRegister = mode === "register";
  const isUpdate = mode === "update";
  const supportsGoogle = mode === "login" || isRegister;

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "callback") {
      setStatus({
        tone: "error",
        text: "We couldn’t verify that email link. It may have expired; request a new link and try again.",
      });
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    if (isRegister) {
      setStatus({
        tone: "info",
        text: "This visual preview does not submit access requests.",
      });
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();

    try {
      const supabase = createClient();

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: String(formData.get("password") ?? ""),
        });

        if (error) {
          setStatus({ tone: "error", text: getErrorMessage(error.message, mode) });
          return;
        }

        setStatus({ tone: "success", text: "You’re signed in successfully." });
        return;
      }

      if (isReset) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
        });

        if (error) {
          setStatus({ tone: "error", text: getErrorMessage(error.message, mode) });
          return;
        }

        setStatus({
          tone: "success",
          text: "If an account matches that email, we’ll send a reset link. Check your inbox and spam folder.",
        });
        return;
      }

      const password = String(formData.get("password") ?? "");
      const confirmPassword = String(formData.get("confirmPassword") ?? "");
      if (password !== confirmPassword) {
        setStatus({
          tone: "error",
          text: "These passwords don’t match. Check both fields and try again.",
        });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setStatus({ tone: "error", text: getErrorMessage(error.message, mode) });
        return;
      }

      setStatus({
        tone: "success",
        text: "Your password was updated. You can now sign in with your new password.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "We couldn’t complete that request. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setStatus(null);
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/`,
        },
      });

      if (error) {
        setStatus({ tone: "error", text: getErrorMessage(error.message, mode) });
      }
    } catch (error) {
      setStatus({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "We couldn’t start Google sign-in. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <span className="auth-eyebrow">
        <i /> {current.eyebrow}
      </span>
      <h1 id="auth-title">{current.title}</h1>
      <p className="auth-description">{current.description}</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        {isRegister && (
          <>
            <label>
              First name
              <input
                autoComplete="given-name"
                name="firstName"
                placeholder="Your first name"
                required
              />
            </label>
            <label>
              Last name
              <input
                autoComplete="family-name"
                name="lastName"
                placeholder="Your last name"
                required
              />
            </label>
          </>
        )}
        <label>
          Work email
          <input
            autoComplete="email"
            name="email"
            placeholder="you@company.com"
            required
            type="email"
          />
        </label>
        {!isReset && !isRegister && (
          <label>
            <span className="label-row">
              <span>{isUpdate ? "New password" : "Password"}</span>
              {mode === "login" && <Link href="/reset-password">Forgot password?</Link>}
            </span>
            <span className="password-field">
              <input
                autoComplete={isRegister || isUpdate ? "new-password" : "current-password"}
                minLength={8}
                name="password"
                placeholder="At least 8 characters"
                required
                type={showPassword ? "text" : "password"}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
          </label>
        )}
        {isUpdate && (
          <label>
            <span>Confirm new password</span>
            <span className="password-field">
              <input
                autoComplete="new-password"
                minLength={8}
                name="confirmPassword"
                placeholder="Enter your new password again"
                required
                type={showPassword ? "text" : "password"}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
          </label>
        )}
        {isRegister && (
          <p className="form-note">
            New accounts remain pending Superadmin approval. Approved users
            receive a link to set a password.
          </p>
        )}
        <button
          type="submit"
          className="button button-dark auth-submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Please wait…" : current.action}
          <span aria-hidden="true">↗</span>
        </button>
        <p
          className={`auth-status${status ? ` auth-status-${status.tone}` : ""}`}
          aria-live="polite"
          role={status?.tone === "error" ? "alert" : undefined}
        >
          {status?.text ?? ""}
        </p>
      </form>
      {supportsGoogle && (
        <>
          <div className="auth-divider" aria-hidden="true">
            <span /> or <span />
          </div>
          <button
            type="button"
            className="button auth-google"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
          >
            <svg aria-hidden="true" viewBox="0 0 48 48" className="google-icon">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.25 5.48-4.73 7.18l7.64 5.93c4.46-4.12 7.13-10.2 7.13-17.58Z" />
              <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19Z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.87l-7.64-5.93c-2.12 1.42-4.84 2.27-8.26 2.27-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
            </svg>
            Continue with Google
          </button>
        </>
      )}
      <p className="auth-footer">{current.footer}</p>
    </section>
  );
}
