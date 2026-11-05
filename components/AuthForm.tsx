"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  loginUser,
  registerUser,
  registerWithGoogle,
  requestPasswordReset,
  signInWithGoogle,
} from "@/lib/actions/auth";
import {
  initialGoogleAuthState,
  initialLoginState,
  initialPasswordResetRequestState,
  initialRegisterState,
} from "@/lib/actions/auth-types";

export type AuthMode = "login" | "register" | "reset";

const content = {
  login: {
    eyebrow: "WELCOME BACK",
    title: "Welcome back",
    description: "Sign in to your Hope, Inc. ERP account",
    action: "Sign In",
    footer: <>Don’t have an account? <Link href="/register">Register</Link></>,
  },
  register: {
    eyebrow: "YOUR NEXT CHAPTER",
    title: "Create your account",
    description: "Join Hope, Inc. ERP",
    action: "Register",
    footer: <>Already have an account? <Link href="/login">Sign in</Link></>,
  },
  reset: {
    eyebrow: "WE'VE GOT YOU",
    title: "Reset password",
    description: "We’ll send you a secure link to reset it",
    action: "Send Reset Link",
    footer: <>Remember your password? <Link href="/login">Back to Sign In</Link></>,
  },
} satisfies Record<
  AuthMode,
  {
    eyebrow: string;
    title: string;
    description: string;
    action: string;
    footer: React.ReactNode;
  }
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
  const [googleRegisterState, googleRegisterAction, isGoogleRegisterPending] =
    useActionState(
      registerWithGoogle,
      initialGoogleAuthState,
    );
  const [googleLoginState, googleLoginAction, isGoogleLoginPending] =
    useActionState(signInWithGoogle, initialGoogleAuthState);
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
          <span className="auth-eyebrow">
            <i /> {current.eyebrow}
          </span>
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
      {((isRegister && registerState.status !== "success") || isLogin) && (
        <>
          <div className="auth-divider" aria-hidden="true">
            <span>or</span>
          </div>
          <form action={isRegister ? googleRegisterAction : googleLoginAction}>
            <button
              className="auth-google-button"
              type="submit"
              disabled={
                (isRegister && isGoogleRegisterPending) ||
                (isLogin && isGoogleLoginPending)
              }
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 48 48"
                width="16"
                height="16"
              >
                <path
                  fill="#FFC107"
                  d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"
                />
                <path
                  fill="#FF3D00"
                  d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"
                />
                <path
                  fill="#4CAF50"
                  d="M12.6 27.7a12 12 0 0 1 0-7.4V15H5.8a20 20 0 0 0 0 18l6.8-5.3Z"
                />
                <path
                  fill="#1976D2"
                  d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8A19.4 19.4 0 0 0 24 4 20 20 0 0 0 5.8 15l6.8 5.3C14.2 15.6 18.7 12 24 12Z"
                />
              </svg>
              {(isRegister && isGoogleRegisterPending) ||
              (isLogin && isGoogleLoginPending)
                ? "Connecting…"
                : "Continue with Google"}
            </button>
          </form>
          {((isRegister && googleRegisterState.status === "error") ||
            (isLogin && googleLoginState.status === "error")) && (
            <p className="auth-status" role="alert" aria-live="polite">
              {isRegister
                ? googleRegisterState.message
                : googleLoginState.message}
            </p>
          )}
        </>
      )}
      <p className="auth-footer">{current.footer}</p>
    </section>
  );
}
