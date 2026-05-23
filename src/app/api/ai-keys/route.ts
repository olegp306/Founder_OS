import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import {
  handleAiKeyReferenceInventory,
  handleAiKeyReferenceRegistration
} from "@/server/project-ai-api-services";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

export async function GET(request: NextRequest) {
  const runtime = getFounderOsRuntime();
  const searchParams = request.nextUrl.searchParams;

  try {
    return NextResponse.json(await handleAiKeyReferenceInventory(runtime, {
      projectKey: searchParams.get("projectKey") ?? undefined,
      provider: searchParams.get("provider") ?? undefined
    }));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid AI key inventory query", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "AI key inventory failed" }, { status: 400 });
  }
}

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
