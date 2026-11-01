"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  loginUser,
  registerUser,
  requestPasswordReset,
} from "@/lib/actions/auth";
import {
  initialLoginState,
  initialPasswordResetRequestState,
  initialRegisterState,
} from "@/lib/actions/auth-types";

export type AuthMode = "login" | "register" | "reset";

const content = {
  login: {
    title: "Welcome back",
    description: "Sign in to your Hope, Inc. ERP account",
    action: "Sign In",
    footer: <>Don’t have an account? <Link href="/register">Register</Link></>,
  },
  register: {
    title: "Create your account",
    description: "Join Hope, Inc. ERP",
    action: "Register",
    footer: <>Already have an account? <Link href="/login">Sign in</Link></>,
  },
  reset: {
    title: "Reset password",
    description: "We’ll send you a secure link to reset it",
    action: "Send Reset Link",
    footer: <>Remember your password? <Link href="/login">Back to Sign In</Link></>,
  },
} satisfies Record<
  AuthMode,
  { title: string; description: string; action: string; footer: React.ReactNode }
>;

export default function AuthForm({
  mode,
  notice = "",
}: {
  mode: AuthMode;
  notice?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [registerState, registerAction, isRegisterPending] = useActionState(
    registerUser,
    initialRegisterState,
  );
  const [loginState, loginAction, isLoginPending] = useActionState(
    loginUser,
    initialLoginState,
  );
  const [passwordResetState, passwordResetAction, isPasswordResetPending] =
    useActionState(requestPasswordReset, initialPasswordResetRequestState);
  const current = content[mode];
  const isReset = mode === "reset";
  const isRegister = mode === "register";
  const isLogin = mode === "login";

  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <header className="auth-card-header">
        <div>
          <h1 id="auth-title">{current.title}</h1>
          <p className="auth-description">{current.description}</p>
        </div>
        <Link className="auth-close" href="/" aria-label="Close and return home">
          ×
        </Link>
      </header>

      {isRegister && registerState.status === "success" ? (
        <div className="register-success" role="status" aria-live="polite">
          <p>{registerState.message}</p>
          <span>
            An Admin or Superadmin must approve your account before you can use
            the system. If prompted, confirm your email before signing in.
          </span>
        </div>
      ) : (
        <form
          className={`auth-form${isRegister ? " register-form" : ""}`}
          action={
            isRegister
              ? registerAction
              : isLogin
                ? loginAction
                : passwordResetAction
          }
        >
          {isRegister && (
            <div className="auth-name-row">
              <div className="auth-field">
                <label htmlFor="firstName">First name</label>
                <input
                  autoComplete="given-name"
                  aria-invalid={Boolean(registerState.fieldErrors?.firstName)}
                  aria-describedby={
                    registerState.fieldErrors?.firstName
                      ? "firstName-error"
                      : undefined
                  }
                  id="firstName"
                  maxLength={80}
                  name="firstName"
                  placeholder="Your first name"
                  required
                />
                {registerState.fieldErrors?.firstName && (
                  <span className="register-field-error" id="firstName-error">
                    {registerState.fieldErrors.firstName}
                  </span>
                )}
              </div>
              <div className="auth-field">
                <label htmlFor="lastName">Last name</label>
                <input
                  autoComplete="family-name"
                  aria-invalid={Boolean(registerState.fieldErrors?.lastName)}
                  aria-describedby={
                    registerState.fieldErrors?.lastName
                      ? "lastName-error"
                      : undefined
                  }
                  id="lastName"
                  maxLength={80}
                  name="lastName"
                  placeholder="Your last name"
                  required
                />
                {registerState.fieldErrors?.lastName && (
                  <span className="register-field-error" id="lastName-error">
                    {registerState.fieldErrors.lastName}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="email">Email address</label>
            <input
              autoComplete="email"
              aria-invalid={
                isRegister && Boolean(registerState.fieldErrors?.email)
              }
              aria-describedby={
                isRegister && registerState.fieldErrors?.email
                  ? "email-error"
                  : undefined
              }
              id="email"
              maxLength={254}
              name="email"
              placeholder="you@company.com"
              required
              type="email"
            />
            {isRegister && registerState.fieldErrors?.email && (
              <span className="register-field-error" id="email-error">
                {registerState.fieldErrors.email}
              </span>
            )}
          </div>

          {!isReset && (
            <div className="auth-field">
              <label className="auth-password-label" htmlFor="password">
                <span>Password</span>
                {isLogin && <Link href="/reset-password">Forgot password?</Link>}
              </label>
              <span className="password-field">
                <input
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  aria-invalid={
                    isRegister && Boolean(registerState.fieldErrors?.password)
                  }
                  aria-describedby={
                    isRegister && registerState.fieldErrors?.password
                      ? "password-error"
                      : undefined
                  }
                  id="password"
                  maxLength={128}
                  minLength={8}
                  name="password"
                  placeholder={isRegister ? "At least 8 characters" : "Password"}
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
              {isRegister && registerState.fieldErrors?.password && (
                <span className="register-field-error" id="password-error">
                  {registerState.fieldErrors.password}
                </span>
              )}
            </div>
          )}

          {isLogin && (
            <div className="auth-login-options">
              <label>
                <input type="checkbox" name="rememberMe" />
                <span>Remember me</span>
              </label>
            </div>
          )}

          {isRegister && (
            <p className="form-note">
              New accounts are created as a User. An Admin or Superadmin must
              approve your account before you can use the system.
            </p>
          )}

          <button
            type="submit"
            className="button button-dark auth-submit"
            disabled={
              (isRegister && isRegisterPending) ||
              (isLogin && isLoginPending) ||
              (isReset && isPasswordResetPending)
            }
          >
            {isRegister && isRegisterPending
              ? "Registering…"
              : isLogin && isLoginPending
                ? "Signing in…"
                : isReset && isPasswordResetPending
                  ? "Sending…"
                  : current.action}
          </button>

          {isRegister ? (
            <p className="auth-status" role="alert" aria-live="polite">
              {registerState.status === "error" ? registerState.message : ""}
            </p>
          ) : isLogin ? (
            <p
              className="auth-status"
              role={loginState.status === "error" ? "alert" : undefined}
              aria-live="polite"
            >
              {loginState.status === "error" ? loginState.message : notice}
            </p>
          ) : (
            <p
              className="auth-status"
              role={passwordResetState.status === "error" ? "alert" : "status"}
              aria-live="polite"
            >
              {passwordResetState.message || notice}
            </p>
          )}
        </form>
      )}
      <p className="auth-footer">{current.footer}</p>
    </section>
  );
}
