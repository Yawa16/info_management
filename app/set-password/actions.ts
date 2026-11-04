"use server";

import { redirect } from "next/navigation";
import { setInitialPassword } from "@/lib/auth/password-setup";

export async function completePasswordSetup(
  token: string,
  _previousError: string | null,
  formData: FormData,
) {
  const password = formData.get("password");
  const confirmation = formData.get("confirmation");

  if (typeof password !== "string" || typeof confirmation !== "string") {
    return "Enter and confirm your new password.";
  }
  if (password.length < 12 || password.length > 128) {
    return "Choose a password between 12 and 128 characters.";
  }
  if (password !== confirmation) {
    return "The passwords do not match.";
  }

  try {
    const completed = await setInitialPassword(token, password);
    if (!completed) {
      return "This setup link is invalid, expired, or has already been used. Request a new link.";
    }
  } catch (error) {
    console.error(
      "First-password setup failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return "Password setup is temporarily unavailable. Try again later or request a new link.";
  }

  redirect("/set-password/complete");
}
