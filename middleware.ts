import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { MODULES } from "@/lib/auth/modules";
import {
  canAccessModule,
  isManagerRole,
  loadAccessSnapshot,
} from "@/lib/auth/rights-check";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const hasAuthSessionCookie = request.cookies
    .getAll()
    .some(({ name }) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name));

  if (!hasAuthSessionCookie) {
    return (await enforceRoutePermission(request, response, undefined)) ?? response;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) {
    console.error("Supabase session refresh failed.", error);
  }

  return (await enforceRoutePermission(request, response, user?.id)) ?? response;
}

const MODULE_PATH =
  /^\/(api\/)?(customers|products|human-resources|sales|reports)(\/|$)/;
const MANAGER_PATH = /^\/(api\/)?users(\/|$)/;
const SUPERADMIN_PATH = /^\/(api\/)?system-settings(\/|$)/;

// First line of defence: refuses direct URLs and API calls that the signed-in
// account has no right for. Pages and actions re-check with requireRight().
async function enforceRoutePermission(
  request: NextRequest,
  response: NextResponse,
  userId: string | undefined,
) {
  const { pathname } = request.nextUrl;
  const moduleMatch = MODULE_PATH.exec(pathname);
  const isManagerPath = MANAGER_PATH.test(pathname);
  const isSuperadminPath = SUPERADMIN_PATH.test(pathname);
  if (!moduleMatch && !isManagerPath && !isSuperadminPath) {
    return null;
  }

  const isApi = pathname.startsWith("/api/");
  const refuse = (status: 401 | 403, redirectTo: string) => {
    const refusal = isApi
      ? NextResponse.json(
          { error: status === 401 ? "Sign in required." : "No access." },
          { status },
        )
      : NextResponse.redirect(new URL(redirectTo, request.url));
    response.cookies.getAll().forEach((cookie) => refusal.cookies.set(cookie));
    return refusal;
  };

  if (!userId) {
    return refuse(401, "/login");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("Permission check unavailable: service role key missing.");
    return refuse(403, "/no-access");
  }

  const snapshot = await loadAccessSnapshot(
    createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    userId,
  );

  const moduleKey = getModuleKey(moduleMatch?.[2]);
  const allowed =
    snapshot !== null &&
    (isSuperadminPath
      ? snapshot.role === "superadmin"
      : isManagerPath
        ? isManagerRole(snapshot.role)
        : moduleKey !== undefined && canAccessModule(snapshot, moduleKey));

  return allowed ? null : refuse(403, "/no-access");
}

function getModuleKey(slug: string | undefined) {
  return MODULES.find((module) => module.key === slug)?.key;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
