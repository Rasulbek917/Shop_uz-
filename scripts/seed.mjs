import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function main() {
  console.log("Ma'lumotlar bazasini tozalash va o'zbekcha boshlang'ich ma'lumotlarni yuklash boshlandi...");

  // Clean existing data
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.returnItem.deleteMany({});
  await prisma.return.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.saleItem.deleteMany({});
  await prisma.sale.deleteMany({});
  await prisma.inventoryTransaction.deleteMany({});
  await prisma.productBatch.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.manufacturer.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.shop.deleteMany({});

  const superAdminPassword = await hashPassword("superpassword123");
  const defaultPassword = await hashPassword("admin123");
  const omborchiPassword = await hashPassword("omborchi123");
  const kassirPassword = await hashPassword("kassir123");

  // 1. Super Admin
  const superAdmin = await prisma.user.create({
    data: {
      role: "SUPER_ADMIN",
      fullName: "Alisher Rustamov (Super Admin)",
      username: "superadmin",
      passwordHash: superAdminPassword,
      phone: "+998 90 123 45 67",
      status: "ACTIVE",
    },
  });
  console.log("✓ Super Admin yaratildi: superadmin / superpassword123");

  // 2. Shop 1: BARAKA MARKET (ACTIVE, 30 days subscription)
  const now = new Date();
  const subEndDate = new Date();
  subEndDate.setDate(now.getDate() + 30);

  const barakaShop = await prisma.shop.create({
    data: {
      name: "BARAKA MARKET",
      phone: "+998 71 200 11 22",
      address: "Toshkent sh., Yunusobod tumani, Amir Temur ko'chasi 14-uy",
      adminName: "Jasur Qosimov",
      status: "ACTIVE",
      subscriptionType: "MONTHLY",
      subscriptionStartDate: now,
      subscriptionEndDate: subEndDate,
    },
  });

  // Users for BARAKA
  const barakaAdmin = await prisma.user.create({
    data: {
      shopId: barakaShop.id,
      role: "SHOP_ADMIN",
      fullName: "Jasur Qosimov (Do‘kon Mudiri)",
      username: "baraka_admin",
      passwordHash: defaultPassword,
      phone: "+998 93 111 22 33",
      status: "ACTIVE",
    },
  });

  const barakaOmborchi = await prisma.user.create({
    data: {
      shopId: barakaShop.id,
      role: "WAREHOUSEMAN",
      fullName: "Bobur Mirzayev (Bosh Omborchi)",
      username: "baraka_omborchi",
      passwordHash: omborchiPassword,
      phone: "+998 94 222 33 44",
      status: "ACTIVE",
    },
  });

  const barakaKassir = await prisma.user.create({
    data: {
      shopId: barakaShop.id,
      role: "CASHIER",
      fullName: "Madina Karimova (Kassir)",
      username: "baraka_kassir",
      passwordHash: kassirPassword,
      phone: "+998 97 333 44 55",
      status: "ACTIVE",
    },
  });

  // Subscription record for BARAKA
  await prisma.subscription.create({
    data: {
      shopId: barakaShop.id,
      planName: "Standart oylik obuna (30 kun)",
      durationDays: 30,
      startDate: now,
      endDate: subEndDate,
      price: 350000,
      status: "ACTIVE",
      activatedBy: "superadmin",
      paymentMethod: "Bank o'tkazmasi",
    },
  });

  // Categories for BARAKA
  const catOziq = await prisma.category.create({
    data: { shopId: barakaShop.id, name: "Oziq-ovqat", description: "Kundalik oziq-ovqat mahsulotlari" },
  });
  const catIchimlik = await prisma.category.create({
    data: { shopId: barakaShop.id, name: "Ichimliklar", description: "Sovuq va issiq ichimliklar" },
  });
  const catShirinlik = await prisma.category.create({
    data: { shopId: barakaShop.id, name: "Shirinliklar", description: "Shirinlik va pishiriqlar" },
  });
  const catUyRozgor = await prisma.category.create({
    data: { shopId: barakaShop.id, name: "Uy-ro‘zg‘r", description: "Uy uchun kerakli buyumlar" },
  });
  const catGigiena = await prisma.category.create({
    data: { shopId: barakaShop.id, name: "Gigiena", description: "Shaxsiy gigiena vositalari" },
  });

  // Suppliers for BARAKA
  const supUlgurji = await prisma.supplier.create({
    data: {
      shopId: barakaShop.id,
      name: "Baraka Ulgurji MChJ",
      phone: "+998 71 220 30 40",
      address: "Toshkent sh., Chilonzor tumani, 5-mavze",
      contactPerson: "Rustam aka",
      totalPurchases: 15400000,
      totalPaid: 13900000,
      debt: 1500000,
    },
  });

  const supOziqTrade = await prisma.supplier.create({
    data: {
      shopId: barakaShop.id,
      name: "Oziq-Ovqat Trade MChJ",
      phone: "+998 71 230 45 67",
      address: "Toshkent sh., Olmazor tumani",
      contactPerson: "Farhod Ergashev",
      totalPurchases: 8200000,
      totalPaid: 8200000,
      debt: 0,
    },
  });

  const supFresh = await prisma.supplier.create({
    data: {
      shopId: barakaShop.id,
      name: "Fresh Drink Distribution",
      phone: "+998 71 207 00 00",
      address: "Toshkent sh., Mirzo Ulug'bek tumani",
      contactPerson: "Dilorom opa",
      totalPurchases: 12000000,
      totalPaid: 7800000,
      debt: 4200000,
    },
  });

  // Customers for BARAKA
  const cust1 = await prisma.customer.create({
    data: {
      shopId: barakaShop.id,
      name: "Anvar Mahmudov",
      phone: "+998 90 999 88 77",
      totalSpent: 125000,
      purchasesCount: 3,
    },
  });

  const cust2 = await prisma.customer.create({
    data: {
      shopId: barakaShop.id,
      name: "Zuhra Aliyeva",
      phone: "+998 91 888 77 66",
      totalSpent: 48000,
      purchasesCount: 1,
    },
  });

  // Products & Batches for BARAKA
  const med1 = await prisma.product.create({
    data: {
      shopId: barakaShop.id,
      name: "Guruch 1 kg",
      barcode: "4780001234567",
      qrCode: "PRD-GURCH-001",
      categoryId: catOziq.id,
      salePrice: 5000,
      minStock: 20,
      unit: "dona",
      description: "Yuqori navli uzun donli guruch",
      status: "ACTIVE",
    },
  });

  const batch1 = await prisma.productBatch.create({
    data: {
      shopId: barakaShop.id,
      productId: med1.id,
      batchNumber: "PT-2026-01",
      initialQuantity: 150,
      currentQuantity: 120,
      purchasePrice: 3500,
      salePrice: 5000,
      expiryDate: new Date("2028-09-22"),
      supplierId: supOziqTrade.id,
      status: "NORMAL",
    },
  });

  const med2 = await prisma.product.create({
    data: {
      shopId: barakaShop.id,
      name: "Qora choy 100 g",
      barcode: "4780002345678",
      qrCode: "PRD-CHOY-100",
      categoryId: catOziq.id,
      salePrice: 4000,
      minStock: 15,
      unit: "dona",
      description: "Qadoqlangan qora choy",
      status: "ACTIVE",
    },
  });

  // Near expiry & low stock batch
  const batch2 = await prisma.productBatch.create({
    data: {
      shopId: barakaShop.id,
      productId: med2.id,
      batchNumber: "PT-2026-02",
      initialQuantity: 50,
      currentQuantity: 8, // Low stock!
      purchasePrice: 2800,
      salePrice: 4000,
      expiryDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), // 25 days left!
      supplierId: supUlgurji.id,
      status: "APPROACHING",
    },
  });

  const med3 = await prisma.product.create({
    data: {
      shopId: barakaShop.id,
      name: "Gazli ichimlik 1.5 l",
      barcode: "4780003456789",
      qrCode: "PRD-ICHIM-015",
      categoryId: catIchimlik.id,
      salePrice: 28000,
      minStock: 10,
      unit: "dona",
      description: "Gazli ichimlik",
      status: "ACTIVE",
    },
  });

  const batch3 = await prisma.productBatch.create({
    data: {
      shopId: barakaShop.id,
      productId: med3.id,
      batchNumber: "PT-2026-03",
      initialQuantity: 60,
      currentQuantity: 45,
      purchasePrice: 21000,
      salePrice: 28000,
      expiryDate: new Date("2027-12-31"),
      supplierId: supFresh.id,
      status: "NORMAL",
    },
  });

  const med4 = await prisma.product.create({
    data: {
      shopId: barakaShop.id,
      name: "Shokolad plitka 100 g",
      barcode: "4780004567890",
      qrCode: "PRD-SHOK-100",
      categoryId: catShirinlik.id,
      salePrice: 38000,
      minStock: 10,
      unit: "dona",
      description: "Sutli shokolad",
      status: "ACTIVE",
    },
  });

  const batch4 = await prisma.productBatch.create({
    data: {
      shopId: barakaShop.id,
      productId: med4.id,
      batchNumber: "PT-2026-04",
      initialQuantity: 40,
      currentQuantity: 32,
      purchasePrice: 29000,
      salePrice: 38000,
      expiryDate: new Date("2028-05-15"),
      supplierId: supOziqTrade.id,
      status: "NORMAL",
    },
  });

  const med5 = await prisma.product.create({
    data: {
      shopId: barakaShop.id,
      name: "Sovun 90 g",
      barcode: "4780005678901",
      qrCode: "PRD-SOVUN-090",
      categoryId: catGigiena.id,
      salePrice: 34000,
      minStock: 10,
      unit: "dona",
      description: "Hammom sovuni",
      status: "ACTIVE",
    },
  });

  const batch5 = await prisma.productBatch.create({
    data: {
      shopId: barakaShop.id,
      productId: med5.id,
      batchNumber: "PT-2026-05",
      initialQuantity: 70,
      currentQuantity: 58,
      purchasePrice: 26000,
      salePrice: 34000,
      expiryDate: new Date("2027-08-20"),
      supplierId: supFresh.id,
      status: "NORMAL",
    },
  });

  const med6 = await prisma.product.create({
    data: {
      shopId: barakaShop.id,
      name: "Makaron 400 g",
      barcode: "4780006789012",
      qrCode: "PRD-MAKAR-400",
      categoryId: catOziq.id,
      salePrice: 42000,
      minStock: 8,
      unit: "dona",
      description: "Qadoqlangan makaron",
      status: "ACTIVE",
    },
  });

  const batch6 = await prisma.productBatch.create({
    data: {
      shopId: barakaShop.id,
      productId: med6.id,
      batchNumber: "PT-2026-06",
      initialQuantity: 30,
      currentQuantity: 24,
      purchasePrice: 33000,
      salePrice: 42000,
      expiryDate: new Date("2027-11-10"),
      supplierId: supUlgurji.id,
      status: "NORMAL",
    },
  });

  // Expired product (to verify system blocks sale of expired products!)
  const medExpired = await prisma.product.create({
    data: {
      shopId: barakaShop.id,
      name: "Sut 1 l (Eski partiya)",
      barcode: "4780008901234",
      qrCode: "PRD-SUT-001",
      categoryId: catOziq.id,
      salePrice: 3500,
      minStock: 5,
      unit: "dona",
      description: "Muddati o'tgan partiya sinov uchun",
      status: "ACTIVE",
    },
  });

  await prisma.productBatch.create({
    data: {
      shopId: barakaShop.id,
      productId: medExpired.id,
      batchNumber: "PT-2024-99",
      initialQuantity: 20,
      currentQuantity: 15,
      purchasePrice: 2000,
      salePrice: 3500,
      expiryDate: new Date("2026-01-01"), // Expired!
      supplierId: supUlgurji.id,
      status: "EXPIRED",
    },
  });

  // Sample Completed Sales
  const sale1 = await prisma.sale.create({
    data: {
      shopId: barakaShop.id,
      receiptNumber: "CHK-20260922-1001",
      cashierId: barakaKassir.id,
      customerId: cust1.id,
      totalAmount: 28000,
      discountAmount: 3000,
      payableAmount: 25000,
      paidAmount: 25000,
      changeAmount: 0,
      paymentMethod: "CASH",
      status: "COMPLETED",
      items: {
        create: [
          {
            productId: med1.id,
            batchId: batch1.id,
            quantity: 2,
            unitPrice: 5000,
            discount: 0,
            totalPrice: 10000,
            purchasePrice: 3500,
          },
          {
            productId: med4.id,
            batchId: batch4.id,
            quantity: 1,
            unitPrice: 38000,
            discount: 3000,
            totalPrice: 35000,
            purchasePrice: 29000,
          },
        ],
      },
      payments: {
        create: {
          shopId: barakaShop.id,
          amount: 25000,
          paymentMethod: "CASH",
          status: "SUCCESS",
        },
      },
    },
  });

  // Notifications for BARAKA
  await prisma.notification.createMany({
    data: [
      {
        shopId: barakaShop.id,
        title: "Qoldiq kamaydi!",
        message: 'Diqqat: "Qora choy 100 g" qoldig\'i 8 donagacha kamaydi.',
        type: "LOW_STOCK",
      },
      {
        shopId: barakaShop.id,
        title: "Yaroqlilik muddati yaqinlashmoqda!",
        message: 'Qora choy (Partiya #PT-2026-02) yaroqlilik muddati 25 kundan so‘ng tugaydi.',
        type: "EXPIRY_APPROACHING",
      },
    ],
  });

  // 3. Shop 2: NAVO MARKET (TRIAL, 5 days remaining)
  const trialEnd = new Date();
  trialEnd.setDate(now.getDate() + 5);

  const navoShop = await prisma.shop.create({
    data: {
      name: "NAVO MARKET",
      phone: "+998 66 300 44 55",
      address: "Samarqand sh., Registon ko'chasi 5-uy",
      adminName: "Alisher Vohidov",
      status: "TRIAL",
      trialStartDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      trialEndDate: trialEnd,
      subscriptionType: "TRIAL",
    },
  });

  await prisma.user.create({
    data: {
      shopId: navoShop.id,
      role: "SHOP_ADMIN",
      fullName: "Alisher Vohidov",
      username: "navo_admin",
      passwordHash: defaultPassword,
      phone: "+998 90 444 55 66",
      status: "ACTIVE",
    },
  });

  // 4. Shop 3: ORZU MARKET (BLOCKED - subscription expired)
  const orzuShop = await prisma.shop.create({
    data: {
      name: "ORZU MARKET",
      phone: "+998 65 221 88 99",
      address: "Buxoro sh., Mustaqillik shoh ko'chasi 28-uy",
      adminName: "Sherzod Jo'rayev",
      status: "BLOCKED",
      subscriptionType: "MONTHLY",
      subscriptionStartDate: new Date("2026-08-01"),
      subscriptionEndDate: new Date("2026-09-01"), // Expired!
      notes: "Oylik obuna to'lovi muddati o'tganligi sababli bloklangan",
    },
  });

  await prisma.user.create({
    data: {
      shopId: orzuShop.id,
      role: "SHOP_ADMIN",
      fullName: "Sherzod Jo'rayev",
      username: "orzu_admin",
      passwordHash: defaultPassword,
      phone: "+998 91 555 66 77",
      status: "ACTIVE",
    },
  });

  // Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        shopId: barakaShop.id,
        userName: "Jasur Qosimov",
        action: "TIZIM_SOZLANDI",
        entity: "Shop",
        details: "BARAKA MARKET sozlamalari va mahsulot katalogi yuklandi",
      },
      {
        shopId: barakaShop.id,
        userName: "Madina Karimova",
        action: "SOTUV_QILINDI",
        entity: "Sale",
        details: "Chek #CHK-20260922-1001: 25 000 so'm (Naqd pul)",
      },
      {
        userName: "Alisher Rustamov (Super Admin)",
        action: "DOKON_QOSHILDI",
        entity: "Shop",
        details: "Yangi do‘kon qo'shildi: NAVO MARKET (7 kunlik sinov)",
      },
      {
        userName: "Alisher Rustamov (Super Admin)",
        action: "DOKON_BLOKLANDI",
        entity: "Shop",
        details: "ORZU MARKET obunasi tugagani sababli bloklandi",
      },
    ],
  });

  console.log("✓ Barcha ma'lumotlar muvaffaqiyatli saqlandi!");
  console.log("------------------------------------------------------------");
  console.log("Kirish hisoblari:");
  console.log("1. Super Admin:      superadmin     / superpassword123");
  console.log("2. Do‘kon Admin:   baraka_admin    / admin123  (Aktiv)");
  console.log("3. Omborchi:         baraka_omborchi / omborchi123");
  console.log("4. Kassir:           baraka_kassir   / kassir123");
  console.log("5. Sinovdagi Admin:  navo_admin   / admin123  (5 kun trial qolgan)");
  console.log("6. Bloklangan Admin: orzu_admin    / admin123  (Bloklash xabarini ko'rish uchun)");
  console.log("------------------------------------------------------------");
}

main()
  .catch((e) => {
    console.error("Seed xatolik:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
