import { NextResponse } from "next/server";
import { parseFounderOsEnv } from "@/domain/readiness/readiness";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    environment: parseFounderOsEnv({
      DATABASE_URL: process.env.DATABASE_URL,
      FOUNDER_OS_ADMIN_EMAIL: process.env.FOUNDER_OS_ADMIN_EMAIL,
      FOUNDER_OS_ADMIN_TOKEN: process.env.FOUNDER_OS_ADMIN_TOKEN
    })
  });
}
