import { NextRequest, NextResponse } from "next/server";
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/api/webhooks/tezcheck") return NextResponse.next();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.headers.get("origin");
    const allowed = process.env.APP_URL ? new URL(process.env.APP_URL).origin : req.nextUrl.origin;
    if ((origin && origin !== allowed) || req.headers.get("sec-fetch-site") === "cross-site") {
      return NextResponse.json({ success: false, error: "So‘rov manbasiga ruxsat yo‘q" }, { status: 403 });
    }
  }
  return NextResponse.next();
}
export const config = { matcher: ["/api/:path*"] };
