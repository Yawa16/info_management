import { NextResponse, type NextRequest } from "next/server";
import { getProfileAccess } from "@/lib/auth/access";
import { getSiteUrl } from "@/lib/site-url";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getSafeNextPath(value: string | null, origin: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  const nextUrl = new URL(value, origin);
  if (nextUrl.origin !== origin) {
    return "/dashboard";
  }

  return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
}

async function signOutAfterGoogleProfileFailure(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
) {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Unable to sign out Google account after profile failure.", {
      code: error.code,
      message: error.message,
      userId,
    });
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const googleFlow = requestUrl.searchParams.get("flow");
  const isGoogleRegistration = googleFlow === "registration";
  const isGoogleLogin = googleFlow === "login";
  let siteOrigin: string;
  try {
    siteOrigin = getSiteUrl();
  } catch (error) {
    console.error("Email confirmation callback is not configured.", error);
    return new NextResponse("Email confirmation is temporarily unavailable.", {
      status: 500,
    });
  }
  const nextPath = getSafeNextPath(
    requestUrl.searchParams.get("next"),
    siteOrigin,
  );
  const errorCode = requestUrl.searchParams.get("error_code")?.toLowerCase();
  const errorDescription =
    requestUrl.searchParams.get("error_description")?.toLowerCase() ?? "";
  const isExpiredRecoveryLink =
    errorCode === "otp_expired" ||
    errorCode === "otp_disabled" ||
    (errorDescription.includes("email link") &&
      (errorDescription.includes("invalid") ||
        errorDescription.includes("expired")));
  const isPasswordRecovery =
    nextPath === "/reset-password/update" ||
    requestUrl.searchParams.get("type") === "recovery" ||
    (googleFlow === "recovery" && isExpiredRecoveryLink);
  const errorPath = isPasswordRecovery
    ? "/reset-password?notice=invalid-link"
    : isGoogleRegistration || isGoogleLogin
      ? "/login?notice=google-error"
      : "/login?notice=confirmation-error";

  if (!code) {
    return NextResponse.redirect(new URL(errorPath, siteOrigin));
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      if (error) {
        console.error("Email confirmation callback failed.", {
          code: error.code,
          message: error.message,
        });
      }

      return NextResponse.redirect(new URL(errorPath, siteOrigin));
    }

    if (isPasswordRecovery) {
      return NextResponse.redirect(new URL(nextPath, siteOrigin));
    }

    if (
      isGoogleRegistration &&
      data.user.app_metadata.provider === "google"
    ) {
      let adminClient: ReturnType<typeof createSupabaseAdminClient>;
      try {
        adminClient = createSupabaseAdminClient();
      } catch (error) {
        console.error("Google account profile creation is not configured.", {
          error,
          userId: data.user.id,
        });
        await signOutAfterGoogleProfileFailure(supabase, data.user.id);
        return NextResponse.redirect(
          new URL("/login?notice=unavailable", siteOrigin),
        );
      }

      const { data: profile, error: profileLookupError } = await adminClient
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileLookupError) {
        console.error("Unable to check Google account profile.", {
          code: profileLookupError.code,
          message: profileLookupError.message,
          userId: data.user.id,
        });
        await signOutAfterGoogleProfileFailure(supabase, data.user.id);
        return NextResponse.redirect(
          new URL("/login?notice=unavailable", siteOrigin),
        );
      }

      if (!profile) {
        const email = data.user.email?.trim().toLowerCase() ?? "";
        const metadata = data.user.user_metadata;
        const fullName =
          [metadata.full_name, metadata.name].find(
            (value): value is string =>
              typeof value === "string" && value.trim().length > 0,
          )?.trim() ?? "";
        const nameParts = fullName.split(/\s+/).filter(Boolean);
        const providerFirstName =
          [metadata.given_name, metadata.first_name].find(
            (value): value is string =>
              typeof value === "string" && value.trim().length > 0,
          )?.trim();
        const firstName =
          providerFirstName ||
          nameParts[0] ||
          email.split("@")[0] ||
          "Google";
        const providerLastName =
          [metadata.family_name, metadata.last_name].find(
            (value): value is string =>
              typeof value === "string" && value.trim().length > 0,
          )?.trim();
        const lastName =
          providerLastName || nameParts.slice(1).join(" ") || "User";

        if (!email) {
          console.error("Google account profile is missing valid signup details.", {
            userId: data.user.id,
          });
          await signOutAfterGoogleProfileFailure(supabase, data.user.id);
          return NextResponse.redirect(
            new URL("/login?notice=google-error", siteOrigin),
          );
        }

        const { error: insertError } = await adminClient
          .from("profiles")
          .insert({
            id: data.user.id,
            first_name: firstName.slice(0, 80),
            last_name: lastName.slice(0, 80),
            email,
            role: "user",
            approval_status: "pending",
          });

        if (insertError) {
          console.error("Unable to create pending Google account profile.", {
            code: insertError.code,
            message: insertError.message,
            userId: data.user.id,
          });
          await signOutAfterGoogleProfileFailure(supabase, data.user.id);
          return NextResponse.redirect(
            new URL("/login?notice=google-error", siteOrigin),
          );
        }
      }
    }

    const access = await getProfileAccess(data.user.id);
    if (access.status !== "approved") {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error("Unable to sign out account after email confirmation.", {
          code: signOutError.code,
          message: signOutError.message,
          userId: data.user.id,
        });
      }

      return NextResponse.redirect(
        new URL(
          access.status === "pending"
            ? "/login?notice=pending"
            : access.status === "blocked"
              ? "/login?notice=blocked"
              : "/login?notice=unavailable",
          siteOrigin,
        ),
      );
    }

    return NextResponse.redirect(
      new URL(
        access.mustChangePassword
          ? "/set-password"
          : nextPath,
        siteOrigin,
      ),
    );
  } catch (error) {
    console.error("Unable to complete email confirmation callback.", error);
    return NextResponse.redirect(new URL(errorPath, siteOrigin));
  }
}
