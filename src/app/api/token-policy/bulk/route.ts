import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { handleBulkTokenPolicySave } from "@/server/api-services";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    return NextResponse.json(await handleBulkTokenPolicySave(runtime, await request.json()));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid bulk token policy",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Bulk token policy save failed" }, { status: 400 });
  }
}
