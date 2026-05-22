import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminRequest } from "@/domain/readiness/readiness";

export function middleware(request: NextRequest) {
  const adminToken = process.env.FOUNDER_OS_ADMIN_TOKEN;

  if (!adminToken) {
    return NextResponse.next();
  }

  const verification = verifyAdminRequest({
    authorization: request.headers.get("authorization") ?? undefined,
    configuredAdminToken: adminToken
  });

  if (verification.allowed) {
    return NextResponse.next();
  }

  return NextResponse.json(
    {
      error: "Admin authorization required",
      reasons: verification.reasons
    },
    { status: 401 }
  );
}

export const config = {
  matcher: ["/api/:path*"]
};
