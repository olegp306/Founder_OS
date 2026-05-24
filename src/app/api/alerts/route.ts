import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";
import { handleAlertList } from "@/server/alert-services";

export async function GET(request: NextRequest) {
  const runtime = getFounderOsRuntime();
  const tokenWindowHours = request.nextUrl.searchParams.get("tokenWindowHours");

  try {
    return NextResponse.json(await handleAlertList(runtime, {
      projectKey: request.nextUrl.searchParams.get("projectKey") ?? undefined,
      asOf: request.nextUrl.searchParams.get("asOf") ?? undefined,
      tokenWindowHours: tokenWindowHours ? Number(tokenWindowHours) : undefined
    }));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid alert request", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Alert projection failed" }, { status: 400 });
  }
}
