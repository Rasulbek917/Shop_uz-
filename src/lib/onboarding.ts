import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
export class BusinessError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const registrationSchema = z.object({
  planCode: z.enum(["PRO", "MAX"]).default("PRO"),
  fullName: z.string().trim().min(2).max(100),
  shopName: z.string().trim().min(2).max(120),
  username: z.string().trim().toLowerCase().min(3).max(40).regex(/^[a-z0-9_.-]+$/, "Login: faqat lotin harflari, raqam, nuqta va chiziq"),
  password: z.string().min(10, "Parol kamida 10 belgidan iborat bo‘lsin").max(72).refine(v => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), "Parolda harf va raqam bo‘lsin"),
  phone: z.string().transform(v => v.replace(/[\s()-]/g, "")).pipe(z.string().regex(/^\+998\d{9}$/, "Telefon: +998 va 9 ta raqam")),
  email: z.string().trim().toLowerCase().email("Email noto‘g‘ri").max(254),
  consent: z.literal(true, { error: "Foydalanish shartlarini qabul qiling" }),
});
export async function registerShop(db: PrismaClient, input: z.infer<typeof registrationSchema>, passwordHash: string) {
  return db.$transaction(async tx => {
    const shop = await tx.shop.create({ data: { name: input.shopName, adminName: input.fullName, phone: input.phone, address: "", status: "AWAITING_PAYMENT", planCode: "NONE", subscriptionType: input.planCode, approvedAt: new Date(),
      users: { create: { fullName: input.fullName, username: input.username, phone: input.phone, email: input.email, passwordHash, role: "SHOP_ADMIN", status: "ACTIVE" } } } });
    await tx.auditLog.create({ data: { shopId: shop.id, action: "ACCOUNT_CREATED", entity: "Shop", entityId: shop.id, details: "Hisob yaratildi. Tanlangan tarif: " + input.planCode } });
    const user = await tx.user.findUniqueOrThrow({ where: { username: input.username }, select: { id: true, username: true, fullName: true, role: true, shopId: true, tokenVersion: true } });
    return { id: shop.id, status: shop.status, user, planCode: input.planCode };
  });
}
export async function reviewRegistration(db: PrismaClient, shopId: string, approve: boolean, reviewer: string, note: string) {
  return db.$transaction(async tx => {
    const updated = await tx.shop.updateMany({ where: { id: shopId, status: "PENDING" }, data: { status: approve ? "AWAITING_PAYMENT" : "REJECTED", approvedAt: approve ? new Date() : null, approvalNote: note } });
    if (!updated.count) throw new BusinessError("Ariza allaqachon ko‘rib chiqilgan yoki topilmadi", 409);
    await tx.auditLog.create({ data: { shopId, userId: reviewer, action: approve ? "REGISTRATION_APPROVED" : "REGISTRATION_REJECTED", entity: "Shop", entityId: shopId, details: note } });
  });
}

export async function grantRegistrationAccess(db: PrismaClient, shopId: string, planCode: "PRO" | "MAX", durationDays: number, reviewer: string, note: string) {
  const now = new Date();
  const end = new Date(now.getTime() + durationDays * 86400000);
  if (!Number.isSafeInteger(durationDays) || durationDays < 1 || !Number.isFinite(end.getTime())) throw new BusinessError("Kunlar soni noto‘g‘ri");
  return db.$transaction(async tx => {
    const shop = await tx.shop.findUnique({ where: { id: shopId } });
    if (!shop || shop.status === "DELETED") throw new BusinessError("Hisob topilmadi", 404);
    await tx.shop.update({ where: { id: shopId }, data: {
      status: "ACTIVE", planCode, subscriptionType: planCode, approvedAt: now,
      subscriptionStartDate: now, subscriptionEndDate: end,
    } });
    await tx.subscription.create({ data: {
      shopId, planName: planCode, price: 0, durationDays, startDate: now, endDate: end,
      status: "ACTIVE", paymentMethod: "ADMIN_GRANT", activatedBy: reviewer,
      notes: note || "Administrator tomonidan ruxsat berildi",
    } });
    await tx.notification.create({ data: {
      shopId, type: "SYSTEM", title: "Hisobga ruxsat berildi",
      message: `${planCode} tarifi ${durationDays} kunga ochildi. ${end.toLocaleDateString("uz-UZ")} gacha faol.`,
    } });
    await tx.auditLog.create({ data: {
      shopId, userId: reviewer, action: "ACCESS_GRANTED", entity: "Shop", entityId: shopId,
      details: JSON.stringify({ planCode, durationDays, endDate: end.toISOString(), note }),
    } });
    return { endDate: end.toISOString(), planCode, durationDays };
  }, { isolationLevel: "Serializable" });
}
export async function requestPurchase(db: PrismaClient, shopId: string, code: string, reference: string, paymentMethod: "UZUM" | "PAYME" | "CLICK" | "MANUAL" = "MANUAL") {
  return db.$transaction(async tx => {
    const shop = await tx.shop.findUnique({ where: { id: shopId } });
    if (!shop || !["AWAITING_PAYMENT", "ACTIVE", "TRIAL", "EXPIRED"].includes(shop.status)) throw new BusinessError("Avval superadmin tasdig‘i kerak", 403);
    const plan = await tx.plan.findUnique({ where: { code } });
    if (!plan || !plan.enabled || plan.price <= 0 || !plan.paymentInstructions.trim()) throw new BusinessError("Bu tarif uchun to‘lov hali ochilmagan");
    if (await tx.purchaseRequest.findFirst({ where: { shopId, status: "PENDING" } })) throw new BusinessError("Sizning to‘lov so‘rovingiz tekshirilmoqda", 409);
    return tx.purchaseRequest.create({ data: { shopId, planCode: code, amount: plan.price, reference: `[${paymentMethod}] ${reference}` } });
  }, { isolationLevel: "Serializable" });
}
export async function reviewPurchase(db: PrismaClient, id: string, approve: boolean, reviewer: string, note: string) {
  return db.$transaction(async tx => {
    const request = await tx.purchaseRequest.findUnique({ where: { id } });
    if (!request) throw new BusinessError("So‘rov topilmadi", 404);
    const changed = await tx.purchaseRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: approve ? "APPROVED" : "REJECTED", reviewNote: note, reviewedBy: reviewer, reviewedAt: new Date() } });
    if (!changed.count) throw new BusinessError("So‘rov allaqachon ko‘rib chiqilgan", 409);
    const shop = await tx.shop.findUniqueOrThrow({ where: { id: request.shopId } });
    if (approve) {
      if (!["AWAITING_PAYMENT", "ACTIVE", "TRIAL", "EXPIRED"].includes(shop.status)) throw new BusinessError("Do‘kon bloklangan yoki tasdiqlanmagan", 403);
      const now = new Date();
      const start = shop.planCode === request.planCode && shop.subscriptionEndDate && shop.subscriptionEndDate > now ? shop.subscriptionEndDate : now;
      const end = new Date(start.getTime() + 30 * 86400000);
      await tx.shop.update({ where: { id: shop.id }, data: { status: "ACTIVE", planCode: request.planCode, subscriptionType: request.planCode, subscriptionStartDate: now, subscriptionEndDate: end } });
      await tx.subscription.create({ data: { shopId: shop.id, planName: request.planCode, price: request.amount, startDate: start, endDate: end, activatedBy: reviewer, paymentMethod: "MANUAL", notes: "Xarid so‘rovi: " + id } });
      await tx.notification.create({ data: { shopId: shop.id, type: "SYSTEM", title: "Tarif faollashtirildi", message: request.planCode + " tarifi " + end.toLocaleDateString("uz-UZ") + " gacha faol." } });
    }
    await tx.auditLog.create({ data: { shopId: shop.id, userId: reviewer, action: approve ? "PURCHASE_APPROVED" : "PURCHASE_REJECTED", entity: "PurchaseRequest", entityId: id, details: note } });
  }, { isolationLevel: "Serializable" });
}
