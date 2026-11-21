import { NextRequest, NextResponse } from "next/server";
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/api/webhooks/tezcheck") return NextResponse.next();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.headers.get("origin");
    const allowed = process.env.APP_URL ? new URL(process.env.APP_URL) : req.nextUrl;
    const localApp = ["localhost", "127.0.0.1"].includes(allowed.hostname);
    const requestOrigin = origin ? new URL(origin) : null;
    const sameLocalPort = localApp && requestOrigin &&
      ["localhost", "127.0.0.1"].includes(requestOrigin.hostname) &&
      requestOrigin.port === allowed.port && requestOrigin.protocol === allowed.protocol;
    if ((requestOrigin && requestOrigin.origin !== allowed.origin && !sameLocalPort) ||
        (req.headers.get("sec-fetch-site") === "cross-site" && !sameLocalPort)) {
      return NextResponse.json({ success: false, error: "So‘rov manbasiga ruxsat yo‘q" }, { status: 403 });
    }
  }
  return NextResponse.next();
}
export const config = { matcher: ["/api/:path*"] };
