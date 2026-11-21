import { formatCurrency } from "@/lib/formatters";

export type PrintableShift = {
  id: string; status: string; openingCash: number; closingCash: number | null;
  openedAt: string; closedAt: string | null; notes: string | null; cashier: { fullName: string };
  cashMovements: Array<{ id: string; type: string; amount: number; note: string; createdAt: string }>;
  summary: {
    salesCount: number; amounts: { CASH: number; CARD: number; ELECTRONIC: number; DEBT: number };
    refunds: number; cashIn: number; cashOut: number; expectedCash: number;
  };
};
const timestamp = (value: string | null) => value ? new Date(value).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" }) : "—";

export default function ShiftPrint({ shift, shopName }: { shift: PrintableShift | null; shopName: string }) {
  if (!shift) return null;
  const summary = shift.summary;
  const lines: Array<[string, number]> = [
    ["Boshlang‘ich naqd", shift.openingCash],
    ["Naqd savdo", summary.amounts.CASH],
    ["Karta", summary.amounts.CARD],
    ["Elektron", summary.amounts.ELECTRONIC],
    ["Nasiya", summary.amounts.DEBT],
    ["Kassaga kirim", summary.cashIn],
    ["Kassadan chiqim", summary.cashOut],
    ["Naqd qaytarish", summary.refunds],
    ["Kutilgan naqd", summary.expectedCash],
  ];
  return <section id="shift-print-area" className="shift-print-area" aria-label="Smena hisoboti">
    <h1>{shopName}</h1>
    <h2>{shift.status === "OPEN" ? "K-HISOBOT" : "Z-HISOBOT"}</h2>
    <p>Do‘kon ichki smena hisoboti</p>
    <p>Smena: {shift.id.slice(0, 8).toUpperCase()}</p>
    <p>Kassir: {shift.cashier.fullName}</p>
    <p>Ochildi: {timestamp(shift.openedAt)}</p>
    <p>Yopildi: {timestamp(shift.closedAt)}</p>
    <p>Cheklar: {summary.salesCount} ta</p>
    {shift.notes && <p>Izoh: {shift.notes}</p>}
    <div className="shift-print-lines">{lines.map(([label, amount]) => <div key={label}><span>{label}</span><strong>{formatCurrency(amount)}</strong></div>)}</div>
    {shift.closingCash !== null && <div className="shift-print-lines"><div><span>Haqiqiy naqd</span><strong>{formatCurrency(shift.closingCash)}</strong></div><div><span>Farq</span><strong>{formatCurrency(shift.closingCash - summary.expectedCash)}</strong></div></div>}
    {shift.cashMovements.length > 0 && <><h3>Naqd harakatlar</h3>{shift.cashMovements.map((item) => <p key={item.id}>{item.type === "IN" ? "Kirim" : "Chiqim"} · {item.note}: {formatCurrency(item.amount)}</p>)}</>}
    <footer>Fiskal hisobot emas · {timestamp(new Date().toISOString())}</footer>
  </section>;
}
