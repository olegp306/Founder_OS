import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ingestStructuredEvent } from "@/domain/events/event-ingestion";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();
  const payload = await request.json();

  try {
    const result = await ingestStructuredEvent({
      events: runtime.events,
      profiles: runtime.profiles,
      payload
    });

    return NextResponse.json({
      status: result.status,
      event: {
        source: result.event.source,
        idempotencyKey: result.event.idempotencyKey,
        name: result.event.event,
        storedAt: result.event.storedAt
      }
    });
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
