export type GuideLanguage = "uz" | "en";

export type GuideLesson = {
  id: string;
  category: string;
  title: Record<GuideLanguage, string>;
  description: Record<GuideLanguage, string>;
  steps: Record<GuideLanguage, string[]>;
  sourceUrl: string;
  startSeconds: number;
  endSeconds: number;
  custom?: boolean;
  overridden?: boolean;
};

const sourceUrl = "/media/savdoza-tutorial.mp4";

export const defaultGuideLessons: GuideLesson[] = [
  {
    id: "setup", category: "setup", sourceUrl, startSeconds: 0, endSeconds: 54.31,
    title: { uz: "Tizimga kirish va smena", en: "Sign in and open a shift" },
    description: { uz: "Bosh sahifani ko‘rish va ish smenasini boshlash.", en: "View the dashboard and start a work shift." },
    steps: { uz: ["Tizimga o‘z hisobingiz bilan kiring.", "Bosh sahifadagi holatni tekshiring.", "Smena bo‘limidan yangi smena oching."], en: ["Sign in with your account.", "Review the dashboard status.", "Open a new shift from the Shifts section."] },
  },
  {
    id: "products", category: "products", sourceUrl, startSeconds: 54.31, endSeconds: 79.13,
    title: { uz: "Mahsulot va kategoriya", en: "Products and categories" },
    description: { uz: "Tovar katalogidagi nom, narx va kodlarni ko‘rish.", en: "Review names, prices and codes in the product catalog." },
    steps: { uz: ["Tovarlar bo‘limini oching.", "Mahsulot nomi, narxi va kodini kiriting.", "Kerakli kategoriyani tanlab saqlang."], en: ["Open Products.", "Enter the product name, price and code.", "Choose a category and save."] },
  },
  {
    id: "inventory", category: "inventory", sourceUrl, startSeconds: 79.13, endSeconds: 106.66,
    title: { uz: "Omborga kirim", en: "Stock intake" },
    description: { uz: "Partiya, kelish narxi va qoldiqni yuritish.", en: "Track batches, purchase price and stock." },
    steps: { uz: ["Ombor bo‘limini oching.", "Tovar va kirim miqdorini tanlang.", "Kelish narxi va yaroqlilik muddatini tekshirib saqlang."], en: ["Open Inventory.", "Choose a product and intake quantity.", "Check the purchase price and expiry date, then save."] },
  },
  {
    id: "pos", category: "sales", sourceUrl, startSeconds: 106.66, endSeconds: 218.71,
    title: { uz: "Kassada sotish va chek", en: "Checkout and receipt" },
    description: { uz: "Qidiruv, skaner, savat, chegirma, to‘lov va chek.", en: "Search, scanner, basket, discount, payment and receipt." },
    steps: { uz: ["Smena ochiq ekanini tekshiring.", "Mahsulotni qidiring yoki shtrix-kodini skanerlang.", "Miqdor va chegirmani tekshiring.", "Naqd yoki karta to‘lovini tanlab yakunlang.", "Chekni ko‘ring yoki chop eting."], en: ["Make sure a shift is open.", "Search for a product or scan its barcode.", "Check quantity and discount.", "Select cash or card and complete payment.", "View or print the receipt."] },
  },
  {
    id: "debts", category: "finance", sourceUrl, startSeconds: 218.71, endSeconds: 265.3,
    title: { uz: "Qarzlar va mijozlar", en: "Debts and customers" },
    description: { uz: "Chek, qaytarish, qarzga sotish va bonus ballari.", en: "Receipts, returns, credit sales and loyalty points." },
    steps: { uz: ["Mijozni tanlang yoki kiriting.", "Qarzga sotish summasini tekshiring.", "Savdoni yakunlab qarzlar ro‘yxatini ko‘ring."], en: ["Select or enter a customer.", "Check the credit sale amount.", "Complete the sale and review the debts list."] },
  },
  {
    id: "reports", category: "reports", sourceUrl, startSeconds: 265.3, endSeconds: 323.86,
    title: { uz: "Smena va hisobotlar", en: "Shifts and reports" },
    description: { uz: "Smenani yopish va sotuv natijalarini ko‘rish.", en: "Close a shift and review sales results." },
    steps: { uz: ["Smenadagi savdolarni tekshiring.", "Smenani yopib Z hisobotni ko‘ring.", "Hisobotlar bo‘limida davrni tanlang."], en: ["Review sales in the current shift.", "Close the shift and view the Z report.", "Select a date range in Reports."] },
  },
  {
    id: "staff", category: "staff", sourceUrl, startSeconds: 323.86, endSeconds: 375.31,
    title: { uz: "Xodimlar va sozlamalar", en: "Staff and settings" },
    description: { uz: "Xodimlar, huquqlar va do‘kon sozlamalari haqida qisqacha.", en: "A brief overview of staff, permissions and store settings." },
    steps: { uz: ["Xodimlar bo‘limida rollarni ko‘ring.", "Sozlamalarda do‘kon ma’lumotlarini tekshiring.", "Kerakli ilovalarni yoqing yoki o‘chiring."], en: ["Review roles in Staff.", "Check store details in Settings.", "Enable or disable the modules you need."] },
  },
];

export const guideCategories: Record<string, Record<GuideLanguage, string>> = {
  setup: { uz: "Boshlash", en: "Getting started" },
  products: { uz: "Mahsulotlar", en: "Products" },
  inventory: { uz: "Ombor", en: "Inventory" },
  sales: { uz: "Kassa", en: "Checkout" },
  finance: { uz: "Moliya", en: "Finance" },
  reports: { uz: "Hisobotlar", en: "Reports" },
  staff: { uz: "Xodimlar", en: "Staff" },
};

export function mergeGuideLessons(saved: GuideLesson[]): GuideLesson[] {
  const overrides = new Map(saved.map((lesson) => [lesson.id, lesson]));
  return [...defaultGuideLessons.map((lesson) => overrides.has(lesson.id) ? { ...overrides.get(lesson.id)!, overridden: true } : lesson), ...saved.filter((lesson) => !defaultGuideLessons.some((item) => item.id === lesson.id))];
}

export function isYouTubeUrl(source: string): boolean {
  try {
    const url = new URL(source);
    return ["youtube.com", "www.youtube.com", "youtu.be", "www.youtube-nocookie.com"].includes(url.hostname);
  } catch { return false; }
}

export function youtubeEmbedUrl(source: string): string | null {
  if (!isYouTubeUrl(source)) return null;
  const url = new URL(source);
  const id = url.hostname === "youtu.be" ? url.pathname.slice(1) : url.pathname.startsWith("/embed/") ? url.pathname.split("/")[2] : url.searchParams.get("v");
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}
