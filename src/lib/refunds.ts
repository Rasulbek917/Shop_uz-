type SaleLine = { id: string; quantity: number; unitPrice: number };
type ReturnedLine = { saleItemId: string; quantity: number; totalRefund: number };
type RefundSale = { payableAmount: number; items: SaleLine[]; returns?: { items: ReturnedLine[] }[] };

export function withRefundInfo<T extends RefundSale>(sale: T) {
  const sorted = [...sale.items].sort((a, b) => a.id.localeCompare(b.id));
  const gross = sorted.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPrice), 0);
  const returned = sale.returns?.flatMap(record => record.items) || [];
  let cumulative = 0;
  const allocations = new Map<string, number>();
  for (const item of sorted) {
    const before = gross > 0 ? Math.round(sale.payableAmount * (cumulative / gross)) : 0;
    cumulative += Math.round(item.quantity * item.unitPrice);
    const after = gross > 0 ? Math.round(sale.payableAmount * (cumulative / gross)) : 0;
    allocations.set(item.id, after - before);
  }
  return {
    ...sale,
    items: sale.items.map(item => {
      const history = returned.filter(row => row.saleItemId === item.id);
      const returnedQuantity = history.reduce((sum, row) => sum + row.quantity, 0);
      const refundedAmount = history.reduce((sum, row) => sum + row.totalRefund, 0);
      const refundAllocation = allocations.get(item.id) || 0;
      return { ...item, returnedQuantity, refundedAmount, refundAllocation, returnableQuantity: Math.max(0, item.quantity - returnedQuantity) } as T["items"][number] & { returnedQuantity: number; refundedAmount: number; refundAllocation: number; returnableQuantity: number };
    }),
  };
}

export function refundForQuantity(item: { quantity: number; returnedQuantity: number; refundedAmount: number; refundAllocation: number }, quantity: number) {
  if (item.quantity <= 0 || quantity <= 0) return 0;
  const before = Math.round(item.refundAllocation * (item.returnedQuantity / item.quantity));
  const after = Math.round(item.refundAllocation * ((item.returnedQuantity + quantity) / item.quantity));
  return Math.max(0, Math.min(after - before, item.refundAllocation - item.refundedAmount));
}
