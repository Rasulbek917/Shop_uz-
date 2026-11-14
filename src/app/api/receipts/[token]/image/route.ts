import { NextRequest, NextResponse } from "next/server";
import { publicReceipt } from "@/lib/public-receipt";
import { receiptImage } from "@/lib/receipt-image";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  req: NextRequest,
  { params: pendingParams }: { params: Promise<{ token: string }> },
) {
  const params = await pendingParams;
  try {
    const receipt = await publicReceipt(params.token);
    if (!receipt) return new NextResponse(null, { status: 404 });
    const filename = `chek-${receipt.receiptNumber.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100)}.png`;
    const disposition =
      req.nextUrl.searchParams.get("download") === "1"
        ? "attachment"
        : "inline";
    return new NextResponse(await receiptImage(receipt), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "X-Robots-Tag": "noindex, nofollow",
        "Content-Security-Policy": "default-src 'none'",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Chek rasmini tayyorlab bo‘lmadi. Qayta urinib ko‘ring." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
