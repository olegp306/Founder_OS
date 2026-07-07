import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";
import { handleProviderSpendImport } from "@/server/provider-spend-services";

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    return NextResponse.json(await handleProviderSpendImport(runtime, await request.json()));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid provider spend import", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Provider spend import failed" }, { status: 400 });
  }
}
