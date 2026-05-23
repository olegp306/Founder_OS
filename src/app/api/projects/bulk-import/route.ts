import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";
import { handleBulkProjectImport } from "@/server/project-ai-api-services";

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    return NextResponse.json(await handleBulkProjectImport(runtime, await request.json()));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid bulk import request", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Bulk project import failed" }, { status: 400 });
  }
}
