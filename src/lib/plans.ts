export const PLAN_PRICES = { PRO: 299000, MAX: 499000 } as const;
export const PLAN_FEATURES = {
  PRO: ["POS: naqd, karta va nasiya savdosi", "Mahsulotlar, ombor va partiyalar", "Mijozlar, qaytarishlar va hisobot", "QR / shtrix-kod va chek chop etish", "Do‘kon egasi uchun boshqaruv"],
  MAX: ["Pro tarifidagi barcha imkoniyatlar", "Kassir va omborchi hisoblari", "Xodimlar huquqlarini boshqarish", "Yetkazib beruvchilar bazasi", "Amallar jurnali va markaziy import"],
};
export function hasShopAccess(shop: { status: string; planCode?: string; trialEndDate?: Date | string | null; subscriptionEndDate?: Date | string | null } | null | undefined) {
  if (!shop || !["ACTIVE", "TRIAL"].includes(shop.status)) return false;
  const end = shop.status === "TRIAL" ? shop.trialEndDate : shop.subscriptionEndDate;
  if (end) return new Date(end).getTime() > Date.now();
  return shop.planCode === "LEGACY";
}
export function isMax(plan?: string | null) { return plan === "MAX" || plan === "LEGACY"; }
export const MAX_API_PREFIXES = ["/api/staff", "/api/suppliers", "/api/audit-logs", "/api/products/central-import"];
