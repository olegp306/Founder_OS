import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { handleAiKeyReferenceRegistration } from "@/server/project-ai-api-services";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    return NextResponse.json(await handleAiKeyReferenceRegistration(runtime, await request.json()));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid AI key reference", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "AI key registration failed" }, { status: 400 });
  }
}
