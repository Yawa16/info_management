"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export type AuthMode = "login" | "register" | "reset";

const content = {
  login: {
    eyebrow: "WELCOME BACK",
    title: "Good to see you.",
    description: "Log in to pick up right where your team left off.",
    action: "Log in to Hope",
    footer: <>New to Hope? <Link href="/register">Create an account</Link></>,
  },
  register: {
    eyebrow: "YOUR NEXT CHAPTER",
    title: "Make room for good work.",
    description: "Create your Hope account and bring your work together.",
    action: "Create your account",
    footer: <>Already have an account? <Link href="/login">Log in</Link></>,
  },
  reset: {
    eyebrow: "WE'VE GOT YOU",
    title: "Let's get you back in.",
    description: "Enter the email address you used to sign up and we’ll help you reset your password.",
    action: "Send reset link",
    footer: <>Remembered your password? <Link href="/login">Back to log in</Link></>,
  },
} satisfies Record<AuthMode, { eyebrow: string; title: React.ReactNode; description: string; action: string; footer: React.ReactNode }>;

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const current = content[mode];
  const isReset = mode === "reset";
  const isRegister = mode === "register";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Authentication isn’t connected yet. Please check back soon.");
  }

  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <span className="auth-eyebrow"><i /> {current.eyebrow}</span>
      <h1 id="auth-title">{current.title}</h1>
      <p className="auth-description">{current.description}</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        {isRegister && (
          <label>
            Full name
            <input autoComplete="name" name="name" placeholder="Your name" required />
          </label>
        )}
        <label>
          Work email
          <input autoComplete="email" name="email" placeholder="you@company.com" required type="email" />
        </label>
        {!isReset && (
          <label>
            <span className="label-row"><span>Password</span>{mode === "login" && <Link href="/reset-password">Forgot password?</Link>}</span>
            <span className="password-field">
              <input autoComplete={isRegister ? "new-password" : "current-password"} minLength={8} name="password" placeholder="At least 8 characters" required type={showPassword ? "text" : "password"} />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button>
            </span>
          </label>
        )}
        {isRegister && <p className="form-note">By creating an account, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.</p>}
        <button type="submit" className="button button-dark auth-submit">{current.action}<span aria-hidden="true">↗</span></button>
        <p className="auth-status" aria-live="polite">{message}</p>
      </form>
      <div className="auth-divider"><span /> or <span /></div>
      <p className="auth-footer">{current.footer}</p>
    </section>
  );
}
