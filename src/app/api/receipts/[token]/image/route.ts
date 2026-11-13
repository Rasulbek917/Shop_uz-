import { NextRequest, NextResponse } from "next/server";
import { publicReceipt, receiptImage } from "@/lib/public-receipt";
export const dynamic = "force-dynamic";
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const receipt = await publicReceipt(params.token);
    if (!receipt) return new NextResponse(null, { status: 404 });
    return new NextResponse(receiptImage(receipt), {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="savdoza-receipt.svg"`,
        "X-Robots-Tag": "noindex, nofollow",
        "Content-Security-Policy": "default-src 'none'",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
