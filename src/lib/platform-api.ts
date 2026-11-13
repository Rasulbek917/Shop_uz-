import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { BusinessError } from "./onboarding";
export function platformError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ success: false, error: error.issues[0].message }, { status: 400 });
  if (error instanceof SyntaxError) return NextResponse.json({ success: false, error: "So‘rov noto‘g‘ri" }, { status: 400 });
  if (error instanceof BusinessError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  const code = (error as { code?: string })?.code;
  if (["P1001", "P1002", "P1003"].includes(code || "")) return NextResponse.json({ success: false, error: "Ma’lumotlar bazasiga ulanish yo‘q. Administratorga murojaat qiling." }, { status: 503 });
  if (["P2021", "P2022"].includes(code || "")) return NextResponse.json({ success: false, error: "Baza yangilanishi yakunlanmagan. Administrator migratsiyani bajarishi kerak." }, { status: 503 });
  if (code === "P2002") return NextResponse.json({ success: false, error: "Login yoki email band" }, { status: 409 });
  if (code === "P2034") return NextResponse.json({ success: false, error: "So‘rovlar to‘qnashdi. Yangilab qayta urinib ko‘ring" }, { status: 409 });
  console.error("Platform request failed", code || "UNKNOWN");
  return NextResponse.json({ success: false, error: "Server bilan bog‘lanib bo‘lmadi. Qayta urinib ko‘ring" }, { status: 500 });
}
