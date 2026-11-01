import { NextResponse, type NextRequest } from "next/server";
import { getProfileAccess } from "@/lib/auth/access";
import { getSiteUrl } from "@/lib/site-url";
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

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
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
  const isPasswordRecovery = nextPath === "/reset-password/update";
  const errorPath = isPasswordRecovery
    ? "/reset-password?notice=invalid-link"
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
            : "/login?notice=unavailable",
          siteOrigin,
        ),
      );
    }

    return NextResponse.redirect(new URL(nextPath, siteOrigin));
  } catch (error) {
    console.error("Unable to complete email confirmation callback.", error);
    return NextResponse.redirect(new URL(errorPath, siteOrigin));
  }
}
