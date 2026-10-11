import { NextRequest, NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/tenant";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireTenantContext(req);
    if (errorResponse) return errorResponse;

    const code = req.nextUrl.searchParams.get("code")?.trim() || "";
    if (!code) {
      return NextResponse.json(
        { success: false, error: { message: "Qidirish kodi ko'rsatilmadi" } },
        { status: 400 }
      );
    }

    const centralUrl = process.env.CENTRAL_CODE_CENTER_URL || "http://localhost:3001";
    const apiKey = process.env.CENTRAL_CODE_CENTER_API_KEY || "pcc_live_9f81a7d3c8e4b2a106e5d9c8b7a6f5e4";

    // Call Central Product Code Center API securely from backend
    try {
      const response = await fetch(`${centralUrl}/api/products/lookup/${encodeURIComponent(code)}`, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "Accept": "application/json",
        },
        // Short timeout to keep POS fast
        next: { revalidate: 0 },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return NextResponse.json({
          success: false,
          error: {
            code: data.error?.code || "NOT_FOUND",
            message: data.error?.message || `"${code}" kodi markaziy bazada topilmadi`,
          },
          data: data.data || null,
        });
      }

      return NextResponse.json({
        success: true,
        message: "Mahsulot markaziy bazadan topildi",
        data: data.data,
      });
    } catch (networkError: any) {
      logger.error("Central Product Center connection error", { error: networkError });
      return NextResponse.json({
        success: false,
        error: {
          code: "CENTRAL_API_UNAVAILABLE",
          message: "Markaziy kodlar markazi (Product Code Center) bilan aloqa o'rnatib bo'lmadi. Server yoki tarmoqni tekshiring.",
        },
      });
    }
  } catch (error: any) {
    logger.error("central-lookup route error", { error });
    return NextResponse.json(
      { success: false, error: { message: "Ichki server xatosi: " + error.message } },
      { status: 500 }
    );
  }
}
