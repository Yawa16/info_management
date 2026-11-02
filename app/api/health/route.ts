import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("health_check");

    if (error) {
      console.error("Supabase health check RPC failed.", {
        code: error.code,
        message: error.message,
      });

      return NextResponse.json(
        { status: "unhealthy", database: "unreachable" },
        { status: 503 },
      );
    }

    if (data !== true) {
      console.error("Supabase health check returned an unexpected result.", {
        data,
      });

      return NextResponse.json(
        { status: "unhealthy", database: "unexpected response" },
        { status: 503 },
      );
    }

    return NextResponse.json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("Supabase health check could not run.", error);
    return NextResponse.json(
      { status: "unhealthy", database: "check unavailable" },
      { status: 503 },
    );
  }
}
