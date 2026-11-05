"use server";

import { redirect } from "next/navigation";
import { getProfileAccess } from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import type {
  GoogleAuthState,
  LoginState,
  PasswordResetRequestState,
  PasswordUpdateState,
  RegisterState,
} from "./auth-types";

function getFormValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function validateRegistration(formData: FormData) {
  const firstName = getFormValue(formData, "firstName");
  const lastName = getFormValue(formData, "lastName");
  const email = getFormValue(formData, "email").toLowerCase();
  const passwordValue = formData.get("password");
  const password = typeof passwordValue === "string" ? passwordValue : "";
  const fieldErrors: NonNullable<RegisterState["fieldErrors"]> = {};

  if (!firstName || firstName.length > 80) {
    fieldErrors.firstName = "Enter a first name (maximum 80 characters).";
  }

  if (!lastName || lastName.length > 80) {
    fieldErrors.lastName = "Enter a last name (maximum 80 characters).";
  }

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    fieldErrors.email = "Enter a valid email address.";
  }

  if (password.length < 8 || password.length > 128) {
    fieldErrors.password =
      "Password must be between 8 and 128 characters.";
  }

  return {
    firstName,
    lastName,
    email,
    password,
    fieldErrors,
  };
}

function getSignUpErrorMessage(error: { code?: string; message: string }) {
  if (error.code === "weak_password") {
    return "Choose a stronger password that meets the password requirements.";
  }

  if (error.code === "email_address_invalid") {
    return "Enter a valid email address.";
  }

  if (error.code === "over_email_send_rate_limit") {
    return "Too many registration attempts. Wait a while and try again.";
  }

  return "We couldn’t create your account. Check your details or try again later.";
}


export async function loginUser(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = getFormValue(formData, "email").toLowerCase();
  const passwordValue = formData.get("password");
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
    return {
      status: "error",
      message: "Enter a valid email address and password.",
    };
  }

  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    console.error("Login is not configured.", error);
    return {
      status: "error",
      message: "Sign in is temporarily unavailable. Please contact support.",
    };
  }

  let signInResult: Awaited<
    ReturnType<typeof supabase.auth.signInWithPassword>
  >;
  try {
    signInResult = await supabase.auth.signInWithPassword({
      email,
      password,
    });
  } catch (requestError) {
    console.error("Supabase sign-in request failed.", requestError);
    return {
      status: "error",
      message: "Sign in is temporarily unavailable. Please try again later.",
    };
  }

  const { data, error } = signInResult;
  if (error || !data.user) {
    if (error) {
      console.error("Supabase sign-in failed.", {
        code: error.code,
        message: error.message,
      });
    }

    return {
      status: "error",
      message: "Email or password is incorrect.",
    };
  }

  let access: Awaited<ReturnType<typeof getProfileAccess>>;
  try {
    access = await getProfileAccess(data.user.id);
  } catch (error) {
    console.error("Unable to check account approval during sign-in.", {
      error,
      userId: data.user.id,
    });
    access = { status: "unavailable" };
  }

  if (access.status !== "approved") {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.error("Unable to sign out account without approved access.", {
        code: signOutError.code,
        message: signOutError.message,
        userId: data.user.id,
      });
    }

    return {
      status: "error",
      message:
        access.status === "pending"
          ? "Your account is waiting for approval."
          : access.status === "blocked"
            ? "Your account is blocked. Contact an Admin for help."
            : "We can’t verify account access right now. Please contact support.",
    };
  }

  if (access.mustChangePassword) {
    redirect("/set-password");
  }

  redirect("/dashboard");
}

export async function requestPasswordReset(
  _previousState: PasswordResetRequestState,
  formData: FormData,
): Promise<PasswordResetRequestState> {
  const email = getFormValue(formData, "email").toLowerCase();
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return {
      status: "error",
      message: "Enter a valid email address.",
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const redirectTo = new URL(
      "/auth/callback?flow=recovery&next=/reset-password/update",
      getSiteUrl(),
    ).toString();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error("Supabase password reset request failed.", {
        code: error.code,
        message: error.message,
      });
      return {
        status: "error",
        message: "We couldn’t send a reset link right now. Please try again later.",
      };
    }

    return {
      status: "success",
      message:
        "If an account exists for that email, a password reset link will be sent.",
    };
  } catch (error) {
    console.error("Password reset is not configured.", error);
    return {
      status: "error",
      message: "Password reset is temporarily unavailable. Please try again later.",
    };
  }
}

export async function updatePassword(
  _previousState: PasswordUpdateState,
  formData: FormData,
): Promise<PasswordUpdateState> {
  const passwordValue = formData.get("password");
  const confirmationValue = formData.get("confirmPassword");
  const password = typeof passwordValue === "string" ? passwordValue : "";
  const confirmPassword =
    typeof confirmationValue === "string" ? confirmationValue : "";

  if (password.length < 8 || password.length > 128) {
    return {
      status: "error",
      message: "Password must be between 8 and 128 characters.",
    };
  }

  if (password !== confirmPassword) {
    return {
      status: "error",
      message: "The passwords do not match.",
    };
  }

  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    console.error("Password update is not configured.", error);
    return {
      status: "error",
      message: "Password update is temporarily unavailable. Please try again.",
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Unable to verify password reset session.", {
      code: authError.code,
      message: authError.message,
    });
  }

  if (!user) {
    return {
      status: "error",
      message: "This reset link is invalid or expired. Request a new one.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("Supabase password update failed.", {
      code: error.code,
      message: error.message,
      userId: user.id,
    });
    return {
      status: "error",
      message:
        error.code === "weak_password"
          ? "Choose a stronger password that meets the password requirements."
          : "We couldn’t update your password. Request a new reset link and try again.",
    };
  }

  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    console.error("Unable to sign out after password update.", {
      code: signOutError.code,
      message: signOutError.message,
      userId: user.id,
    });
  }

  redirect("/login?notice=password-updated");
}

export async function setInitialPassword(
  _previousState: PasswordUpdateState,
  formData: FormData,
): Promise<PasswordUpdateState> {
  const passwordValue = formData.get("password");
  const confirmationValue = formData.get("confirmPassword");
  const password = typeof passwordValue === "string" ? passwordValue : "";
  const confirmPassword =
    typeof confirmationValue === "string" ? confirmationValue : "";

  if (password.length < 8 || password.length > 128) {
    return {
      status: "error",
      message: "Password must be between 8 and 128 characters.",
    };
  }

  if (password !== confirmPassword) {
    return {
      status: "error",
      message: "The passwords do not match.",
    };
  }

  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    console.error("First-login password update is not configured.", error);
    return {
      status: "error",
      message: "Password setup is temporarily unavailable. Please try again.",
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Unable to verify first-login password session.", {
      code: authError.code,
      message: authError.message,
    });
  }

  if (!user) {
    redirect("/login");
  }

  const access = await getProfileAccess(user.id);
  if (access.status === "pending") {
    return {
      status: "error",
      message: "Your account is waiting for approval.",
    };
  }
  if (access.status === "blocked") {
    return {
      status: "error",
      message: "Your account is blocked. Contact an Admin for help.",
    };
  }
  if (access.status === "unavailable") {
    return {
      status: "error",
      message: "We can’t verify account access right now. Please contact support.",
    };
  }

  if (!access.mustChangePassword) {
    redirect("/dashboard");
  }

  const { error: passwordError } = await supabase.auth.updateUser({
    password,
  });
  if (passwordError) {
    console.error("Supabase first-login password update failed.", {
      code: passwordError.code,
      message: passwordError.message,
      userId: user.id,
    });
    return {
      status: "error",
      message:
        passwordError.code === "weak_password"
          ? "Choose a stronger password that meets the password requirements."
          : "We couldn’t update your password. Please try again.",
    };
  }

  let adminClient: ReturnType<typeof createSupabaseAdminClient>;
  try {
    adminClient = createSupabaseAdminClient();
  } catch (error) {
    console.error("Password changed, but first-login setup could not finish.", {
      error,
      userId: user.id,
    });
    return {
      status: "error",
      message:
        "Your password was changed, but setup could not be completed. Contact an Admin.",
    };
  }

  const { data: updatedProfiles, error: profileError } = await adminClient
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id)
    .eq("must_change_password", true)
    .eq("is_blocked", false)
    .eq("approval_status", "approved")
    .select("id");

  if (profileError || !updatedProfiles?.length) {
    console.error("Unable to clear first-login password flag.", {
      code: profileError?.code,
      message: profileError?.message,
      userId: user.id,
    });
    return {
      status: "error",
      message:
        "Your password was changed, but setup could not be completed. Contact an Admin.",
    };
  }

  redirect("/dashboard");
}

export async function registerUser(
  _previousState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const { firstName, lastName, email, password, fieldErrors } =
    validateRegistration(formData);

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please correct the highlighted fields.",
      fieldErrors,
    };
  }

  let adminClient: ReturnType<typeof createSupabaseAdminClient>;
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  let emailRedirectTo: string;

  try {
    adminClient = createSupabaseAdminClient();
    supabase = await createSupabaseServerClient();
    emailRedirectTo = new URL("/auth/callback", getSiteUrl()).toString();
  } catch (error) {
    console.error("Registration is not configured.", error);
    return {
      status: "error",
      message: "Registration is temporarily unavailable. Please contact support.",
    };
  }

  let signUpResponse;
  try {
    signUpResponse = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });
  } catch (error) {
    console.error("Supabase Auth registration request failed.", error);
    return {
      status: "error",
      message: "Registration is temporarily unavailable. Please try again.",
    };
  }

  const { data, error: signUpError } = signUpResponse;

  if (signUpError) {
    console.error("Supabase Auth registration failed.", {
      code: signUpError.code,
      message: signUpError.message,
    });
    return {
      status: "error",
      message: getSignUpErrorMessage(signUpError),
    };
  }

  if (!data.user) {
    console.error("Supabase Auth registration returned no user.");
    return {
      status: "error",
      message: "We couldn’t complete your registration. Please try again.",
    };
  }

  if (data.user.identities?.length === 0) {
    return {
      status: "error",
      message: "We couldn’t complete registration with those details. Please try again or sign in.",
    };
  }

  let profileError: { code?: string; message: string } | null;
  try {
    const result = await adminClient.from("profiles").insert({
      id: data.user.id,
      first_name: firstName,
      last_name: lastName,
      email,
      role: "user",
      approval_status: "pending",
    });
    profileError = result.error;
  } catch (error) {
    console.error("Profile insert request failed after Auth signup.", error);
    profileError = {
      message: "Profile insert request failed.",
    };
  }

  if (profileError) {
    console.error("Profile creation failed after Auth signup.", {
      code: profileError.code,
      message: profileError.message,
      userId: data.user.id,
    });

    try {
      const { error: cleanupError } = await adminClient.auth.admin.deleteUser(
        data.user.id,
      );
      if (cleanupError) {
        console.error("Unable to remove Auth user after profile creation failed.", {
          code: cleanupError.code,
          message: cleanupError.message,
          userId: data.user.id,
        });
      }
    } catch (error) {
      console.error("Auth user cleanup request failed.", {
        error,
        userId: data.user.id,
      });
    }

    return {
      status: "error",
      message:
        "We couldn’t finish creating your account. Please try again or contact support.",
    };
  }

  if (data.session) {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.error("Unable to clear session for pending new account.", {
        code: signOutError.code,
        message: signOutError.message,
        userId: data.user.id,
      });
    }
  }

  return {
    status: "success",
    message: "Your account is waiting for approval",
  };
}

async function startGoogleAuth(
  flow: "registration" | "login",
): Promise<GoogleAuthState> {
  let authorizationUrl: string;

  try {
    const supabase = await createSupabaseServerClient();
    const redirectTo = new URL(
      `/auth/callback?flow=${flow}`,
      getSiteUrl(),
    ).toString();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      console.error("Supabase Google authentication failed.", {
        code: error.code,
        message: error.message,
        flow,
      });
      return {
        status: "error",
        message: "Google authentication is unavailable. Please try again later.",
      };
    }

    if (!data.url) {
      console.error("Supabase returned no Google authorization URL.", { flow });
      return {
        status: "error",
        message: "Google authentication is unavailable. Please try again later.",
      };
    }

    authorizationUrl = data.url;
  } catch (error) {
    console.error("Google authentication is not configured.", { error, flow });
    return {
      status: "error",
      message: "Google authentication is temporarily unavailable. Please try again.",
    };
  }

  redirect(authorizationUrl);
}

export async function registerWithGoogle(
  _previousState: GoogleAuthState,
  _formData: FormData,
): Promise<GoogleAuthState> {
  void _previousState;
  void _formData;
  return startGoogleAuth("registration");
}

export async function signInWithGoogle(
  _previousState: GoogleAuthState,
  _formData: FormData,
): Promise<GoogleAuthState> {
  void _previousState;
  void _formData;
  return startGoogleAuth("login");
}

export async function signOutUser() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Supabase sign-out failed.", {
      code: error.code,
      message: error.message,
    });
    throw new Error("Unable to sign out. Please try again.");
  }

  redirect("/login");
}
