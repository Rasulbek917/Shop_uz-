import { prisma } from "./prisma";

/**
 * Validates EAN-13 checksum.
 * EAN-13 must be 13 digits where the last digit equals the calculated check digit.
 */
export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;

  const digits = code.split("").map(Number);
  const checkDigit = digits[12];

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += i % 2 === 0 ? digits[i] : digits[i] * 3;
  }

  const calculatedCheck = (10 - (sum % 10)) % 10;
  return checkDigit === calculatedCheck;
}

/**
 * Calculates EAN-13 check digit for 12 digits.
 */
export function calculateEan13CheckDigit(first12Digits: string): string {
  if (!/^\d{12}$/.test(first12Digits)) {
    throw new Error("Must be exactly 12 digits to calculate EAN-13 check digit");
  }
  const digits = first12Digits.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += i % 2 === 0 ? digits[i] : digits[i] * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return `${first12Digits}${check}`;
}

/**
 * Generates the next sequential unique SKU (e.g. SM-000001) for a store.
 * Inspects existing products in database to never collide or reuse identifiers.
 */
export async function getNextStoreSku(shopId?: string): Promise<string> {
  // 1. Query existing products that match SM-XXXXXX pattern
  const whereClause: any = {
    OR: [
      { barcode: { startsWith: "SM-" } },
      { qrCode: { startsWith: "SM-" } },
    ],
  };
  if (shopId) {
    whereClause.shopId = shopId;
  }

  const existing = await prisma.product.findMany({
    where: whereClause,
    select: { barcode: true, qrCode: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  let maxNum = 0;
  for (const p of existing) {
    for (const code of [p.barcode, p.qrCode]) {
      if (code && code.startsWith("SM-")) {
        const numPart = parseInt(code.replace(/^SM-/, ""), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    }
  }

  // Also count total products to ensure uniqueness if prefix is different
  const totalCount = await prisma.product.count({
    where: shopId ? { shopId } : {},
  });

  const nextNumber = Math.max(maxNum + 1, totalCount + 1);
  const padded = String(nextNumber).padStart(6, "0");
  return `SM-${padded}`;
}
