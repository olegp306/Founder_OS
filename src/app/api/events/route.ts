import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { handleStructuredEventIngestion } from "@/server/api-services";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();
  const payload = await request.json();

  try {
    return NextResponse.json(await handleStructuredEventIngestion(runtime, payload));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid structured event",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Event ingestion failed"
      },
      { status: 400 }
    );
  }
}
