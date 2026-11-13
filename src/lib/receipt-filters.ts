import { z } from "zod";
import type { Prisma } from "@prisma/client";
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Sana noto‘g‘ri")
  .optional();
const querySchema = z
  .object({
    search: z.string().trim().max(100).default(""),
    from: date,
    to: date,
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    "Sana oralig‘i noto‘g‘ri",
  );
export function receiptFilters(
  params: URLSearchParams,
  shopId: string,
  cashierId?: string,
) {
  const query = querySchema.parse(Object.fromEntries(params));
  const where: Prisma.SaleWhereInput = {
    shopId,
    ...(cashierId ? { cashierId } : {}),
  };
  if (query.search)
    where.receiptNumber = { contains: query.search, mode: "insensitive" };
  if (query.from || query.to)
    where.createdAt = {
      ...(query.from ? { gte: new Date(`${query.from}T00:00:00+05:00`) } : {}),
      ...(query.to
        ? {
            lt: new Date(
              new Date(`${query.to}T00:00:00+05:00`).getTime() + 86400000,
            ),
          }
        : {}),
    };
  return { where, page: query.page };
}
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
