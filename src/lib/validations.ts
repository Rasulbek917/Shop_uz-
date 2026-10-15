import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(3, "Login kamida 3 ta belgidan iborat bo‘lishi kerak"),
  password: z.string().min(5, "Parol kamida 5 ta belgidan iborat bo‘lishi kerak"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Joriy parolni kiriting"),
    newPassword: z.string().min(5, "Yangi parol kamida 5 ta belgidan iborat bo‘lishi kerak"),
    confirmPassword: z.string().min(1, "Yangi parolni qayta kiriting"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Yangi parol va tasdiqlash paroli mos kelmadi",
    path: ["confirmPassword"],
  });

export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .min(2, "Ism-familiya kamida 2 ta belgidan iborat bo‘lishi kerak")
    .optional(),
  phone: z
    .string()
    .max(30, "Telefon raqami juda uzun")
    .optional()
    .nullable(),
  username: z
    .string()
    .min(3, "Login kamida 3 ta belgidan iborat bo‘lishi kerak")
    .max(50, "Login juda uzun")
    .regex(/^\S+$/, "Login bo‘sh joy (probel) bo‘lmasligi kerak")
    .optional(),
});

export const createShopSchema = z.object({
  name: z.string().min(2, "Do‘kon nomi kamida 2 ta belgidan iborat bo‘lishi kerak"),
  phone: z.string().min(7, "Telefon raqami noto‘g‘ri kiritildi"),
  address: z.string().min(3, "Manzilni to‘liqroq kiriting"),
  adminName: z.string().min(2, "Administrator ismi kamida 2 ta belgi bo‘lishi kerak"),
  adminUsername: z.string().min(3, "Administrator logini kamida 3 ta belgi bo‘lishi kerak"),
  adminPassword: z.string().min(5, "Administrator paroli kamida 5 ta belgi bo‘lishi kerak"),
  trialDays: z.number().int().min(1).default(7),
  subscriptionType: z.enum(["TRIAL", "MONTHLY"]).default("MONTHLY"),
  subscriptionDays: z.number().int().min(1).default(30),
});

export const updateShopSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(7).optional(),
  address: z.string().min(3).optional(),
  adminName: z.string().min(2).optional(),
  adminUsername: z.string().min(3, "Admin logini kamida 3 ta belgidan iborat bo‘lishi kerak").optional(),
  adminPassword: z.string().min(5, "Admin paroli kamida 5 ta belgidan iborat bo‘lishi kerak").optional(),
  status: z.enum(["ACTIVE", "TRIAL", "BLOCKED", "DELETED"]).optional(),
  notes: z.string().optional().nullable(),
});

export const activateSubscriptionSchema = z.object({
  shopId: z.string().uuid("Noto‘g‘ri do‘kon IDsi"),
  durationDays: z.number().int().min(1).default(30),
  planName: z.string().default("Oylik obuna (30 kun)"),
  price: z.number().min(0).default(0),
  paymentMethod: z.string().optional(),
});

export const categorySchema = z.object({
  name: z.string().min(2, "Kategoriya nomi kamida 2 ta belgi bo‘lishi kerak"),
  description: z.string().optional().nullable(),
});

export const manufacturerSchema = z.object({
  name: z.string().min(2, "Ishlab chiqaruvchi nomi kamida 2 ta belgi bo‘lishi kerak"),
  country: z.string().optional().nullable(),
});

export const productSchema = z.object({
  name: z.string().min(2, "Mahsulot nomi kamida 2 ta belgi bo‘lishi kerak"),
  barcode: z.string().optional().nullable(),
  qrCode: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  manufacturerId: z.string().optional().nullable(),
  salePrice: z.number().min(0, "Sotuv narxi manfiy bo‘lishi mumkin emas"),
  minStock: z.number().int().min(0).default(5),
  unit: z.string().default("dona"),
  description: z.string().optional().nullable(),
});

export const inflowSchema = z.object({
  productId: z.string().min(1, "Mahsulotni tanlang"),
  batchNumber: z.string().min(1, "Partiya raqamini kiriting"),
  quantity: z.number().int().positive("Kirim miqdori 0 dan katta bo‘lishi kerak"),
  purchasePrice: z.number().min(0, "Kelish narxi manfiy bo‘lmasin"),
  salePrice: z.number().min(0, "Sotuv narxi manfiy bo‘lmasin"),
  expiryDate: z.string().min(1, "Yaroqlilik muddatini kiriting"),
  supplierId: z.string().optional().nullable(),
});

export const saleItemSchema = z.object({
  productId: z.string().min(1),
  batchId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).default(0),
});

export const saleSchema = z.object({
  customerId: z.string().optional().nullable(),
  paymentMethod: z.enum(["CASH", "CARD", "ELECTRONIC"]),
  discountAmount: z.number().min(0).default(0),
  paidAmount: z.number().min(0),
  items: z.array(saleItemSchema).min(1, "Savatchada kamida bitta mahsulot bo‘lishi shart"),
  notes: z.string().optional().nullable(),
  idempotencyKey: z.string().optional().nullable(),
});

export const debtSaleSchema = z.object({
  customerId: z.string().optional().nullable(),
  firstName: z.string().min(2, "Ism kamida 2 ta belgi bo‘lishi kerak"),
  lastName: z.string().min(2, "Familiya kamida 2 ta belgi bo‘lishi kerak"),
  phone: z.string().optional().nullable(),
  discountAmount: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  items: z.array(saleItemSchema).min(1, "Savatchada kamida bitta mahsulot bo‘lishi shart"),
  idempotencyKey: z.string().optional().nullable(),
});

export const returnItemSchema = z.object({
  saleItemId: z.string().min(1),
  productId: z.string().min(1),
  batchId: z.string().min(1),
  quantity: z.number().int().positive(),
  refundUnitPrice: z.number().min(0),
});

export const returnSchema = z.object({
  saleId: z.string().min(1, "Sotuv ID kiritilmadi"),
  reason: z.string().optional().nullable(),
  items: z.array(returnItemSchema).min(1, "Kamida bitta qaytariladigan tovar belgilansin"),
});

export const staffSchema = z.object({
  fullName: z.string().min(2, "Xodim ismi kamida 2 ta belgi bo‘lishi kerak"),
  username: z.string().min(3, "Login kamida 3 ta belgi bo‘lishi kerak"),
  password: z.string().min(5, "Parol kamida 5 ta belgi bo‘lishi kerak"),
  phone: z.string().optional().nullable(),
  role: z.enum(["SHOP_ADMIN", "WAREHOUSEMAN", "CASHIER"]),
});

export const updateStaffSchema = z.object({
  fullName: z.string().min(2, "Xodim ismi kamida 2 ta belgi bo‘lishi kerak").optional(),
  username: z.string().min(3, "Login kamida 3 ta belgi bo‘lishi kerak").optional(),
  password: z.string().min(5, "Parol kamida 5 ta belgi bo‘lishi kerak").optional(),
  phone: z.string().optional().nullable(),
  role: z.enum(["SHOP_ADMIN", "WAREHOUSEMAN", "CASHIER"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]).optional(),
});

export const supplierSchema = z.object({
  name: z.string().min(2, "Ta'minotchi nomi kamida 2 ta belgi bo‘lishi kerak"),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  debt: z.number().default(0),
  notes: z.string().optional().nullable(),
});

export const debtSchema = z.object({
  firstName: z.string().min(2, "Ism kamida 2 ta belgi bo‘lishi kerak"),
  lastName: z.string().min(2, "Familiya kamida 2 ta belgi bo‘lishi kerak"),
  phone: z.string().optional().nullable(),
  amount: z.number().min(0, "Qarz miqdori manfiy bo‘lmasligi kerak"),
  description: z.string().optional().nullable(),
  status: z.enum(["OPEN", "PAID", "CANCELLED"]).optional(),
});
