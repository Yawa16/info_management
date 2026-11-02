import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next") ?? "/sign-in";
  const destination = new URL(requestedNext, request.url);
  const next =
    destination.origin === request.nextUrl.origin
      ? destination
      : new URL("/sign-in", request.url);

  if (!code) {
    return NextResponse.redirect(new URL("/sign-in?error=callback", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Supabase auth callback failed.", error);
    return NextResponse.redirect(new URL("/sign-in?error=callback", request.url));
  }

  return NextResponse.redirect(next);
}
