import { NextResponse } from "next/server";
import { SupabaseConfigurationError } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("health_check");

    if (error) {
      console.error("Supabase database health check failed.", error);
      return NextResponse.json(
        { status: "unhealthy", database: "unavailable" },
        { status: 503 },
      );
    }

    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      console.error("Supabase database health check is not configured.", error);
    } else {
      console.error("Supabase database health check could not complete.", error);
    }

    return NextResponse.json(
      { status: "unhealthy", database: "unavailable" },
      { status: 503 },
    );
  }
}
