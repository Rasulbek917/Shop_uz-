"use client";

import React, { useState, useEffect } from "react";
import { Users, Plus, Search, X, CheckCircle, Edit, History } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getErrorMessage } from "@/lib/errorMessage";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", phone: "+998 ", notes: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [detailForm, setDetailForm] = useState({ name: "", phone: "", notes: "" });
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/customers");
      const data = await res.json();
      if (data.success) {
        setCustomers(data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message);
        setShowAddModal(false);
        setFormData({ name: "", phone: "+998 ", notes: "" });
        loadCustomers();
      } else {
        alert(getErrorMessage(data.error, "Xatolik yuz berdi"));
      }
    } catch (e) {
      alert("Server xatosi");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = customers.filter((c) => {
    return (
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone && c.phone.includes(search))
    );
  });

  const openDetail = async (id: string) => {
    setSelected(null); setEditing(false); setDetailError(""); setDetailLoading(true);
    try {
      const response = await fetch(`/api/customers/${id}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(getErrorMessage(result.error, "Mijoz ma’lumotlari yuklanmadi"));
      setSelected(result.data);
      setDetailForm({ name: result.data.name, phone: result.data.phone || "", notes: result.data.notes || "" });
    } catch (error) { setDetailError(error instanceof Error ? error.message : "Xatolik yuz berdi"); }
    finally { setDetailLoading(false); }
  };

  const saveDetail = async (event: React.FormEvent) => {
    event.preventDefault(); if (!selected) return;
    setIsSubmitting(true); setDetailError("");
    try {
      const response = await fetch(`/api/customers/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(detailForm) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(getErrorMessage(result.error, "Saqlab bo‘lmadi"));
      setEditing(false); setSuccessMsg("Mijoz ma’lumotlari yangilandi");
      await Promise.all([openDetail(selected.id), loadCustomers()]);
    } catch (error) { setDetailError(error instanceof Error ? error.message : "Saqlab bo‘lmadi"); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
            Doimiy Mijozlar Bazasi
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Mijozlar xaridlari, umumiy sarflangan summa va aloqa ma'lumotlari
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 rounded-xl bg-[#1e50b3] px-4 py-2.5 text-xs md:text-sm font-bold text-white shadow-md shadow-primary-600/20 hover:bg-[#123d99]"
        >
          <Plus className="h-4 w-4" />
          <span>Yangi Mijoz Qo‘shish</span>
        </button>
      </div>

      {successMsg && (
        <div className="rounded-xl border border-primary-200 bg-primary-50 p-4 text-xs font-bold text-primary-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>×</button>
        </div>
      )}

      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Mijoz ismi yoki telefon raqami bo‘yicha qidirish..."
          className="w-full text-xs md:text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Mijoz Ismi</th>
                <th className="px-4 py-3.5">Telefon</th>
                <th className="px-4 py-3.5">Xaridlar Soni</th>
                <th className="px-4 py-3.5">Jami Sarflangan Summa</th>
                <th className="px-4 py-3.5">Ballar</th>
                <th className="px-4 py-3.5">A'zo Bo‘lgan Sana</th>
                <th className="px-5 py-3.5 text-right">Izoh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    Yuklanmoqda...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    Mijozlar topilmadi.
                  </td>
                </tr>
              ) : (
                filtered.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-900 text-sm">
                      <button type="button" onClick={() => openDetail(customer.id)} className="text-left text-[#1e50b3] hover:underline">{customer.name}</button>
                    </td>

                    <td className="px-4 py-3.5 font-semibold text-slate-700">
                      {customer.phone || "-"}
                    </td>

                    <td className="px-4 py-3.5 text-slate-800 font-bold">
                      {customer.purchasesCount} marta
                    </td>

                    <td className="px-4 py-3.5 font-extrabold text-primary-700 text-sm">
                      {formatCurrency(customer.totalSpent)}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-emerald-700">{Math.max(0, customer.loyaltyPoints)} ta</td>

                    <td className="px-4 py-3.5 text-slate-500">
                      {formatDate(customer.createdAt)}
                    </td>

                    <td className="px-5 py-3.5 text-right text-slate-500">
                      <button type="button" onClick={() => openDetail(customer.id)} className="rounded border border-blue-200 px-3 py-1.5 font-semibold text-blue-700">Tarix</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(selected || detailLoading || detailError) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3" onClick={() => { setSelected(null); setDetailError(""); }}><section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-bold text-slate-900">{selected?.name || "Mijoz kartasi"}</h3><p className="text-sm text-slate-500">Xaridlar, qaytarishlar va bonus ballari</p></div><button type="button" aria-label="Yopish" onClick={() => { setSelected(null); setDetailError(""); }}><X size={20} /></button></div>{detailError && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{detailError}</p>}{detailLoading && <p className="py-8 text-sm text-slate-500">Yuklanmoqda...</p>}{selected && <><div className="mt-5 grid gap-3 sm:grid-cols-3">{[["Xaridlar", `${selected.purchasesCount} ta`], ["Jami sarflangan", formatCurrency(selected.totalSpent)], ["Mavjud ball", `${Math.max(0, selected.loyaltyPoints)} ball`]].map(([label, value]) => <div key={label} className="rounded-lg border border-blue-100 bg-blue-50 p-3"><p className="text-xs text-slate-600">{label}</p><strong className="text-lg text-[#1e50b3]">{value}</strong></div>)}</div><p className="mt-3 text-xs text-slate-500">Har 10 000 so‘m xaridga 1 ball. 1 ball = 1 000 so‘m chegirma.</p><div className="mt-5 flex items-center justify-between"><h4 className="font-bold">Aloqa ma’lumotlari</h4><button type="button" onClick={() => setEditing(!editing)} className="flex items-center gap-1 text-sm font-semibold text-[#1e50b3]"><Edit size={15} /> Tahrirlash</button></div>{editing ? <form onSubmit={saveDetail} className="mt-3 grid gap-3 sm:grid-cols-2"><input aria-label="Mijoz ismi" required value={detailForm.name} onChange={(event) => setDetailForm({ ...detailForm, name: event.target.value })} className="rounded border p-2" /><input aria-label="Telefon" value={detailForm.phone} onChange={(event) => setDetailForm({ ...detailForm, phone: event.target.value })} className="rounded border p-2" /><input aria-label="Izoh" value={detailForm.notes} onChange={(event) => setDetailForm({ ...detailForm, notes: event.target.value })} className="rounded border p-2 sm:col-span-2" /><button disabled={isSubmitting} className="rounded bg-[#1e50b3] px-4 py-2 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">Saqlash</button></form> : <p className="mt-2 text-sm text-slate-600">{selected.phone || "Telefon kiritilmagan"} · {selected.notes || "Izoh yo‘q"}</p>}<h4 className="mt-6 flex items-center gap-2 font-bold"><History size={18} /> Xaridlar tarixi</h4><div className="mt-3 space-y-3">{selected.sales?.length ? selected.sales.map((sale: any) => <article key={sale.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><strong>{sale.receiptNumber}</strong><span className="ml-2 text-xs text-slate-500">{formatDate(sale.createdAt)} · {sale.cashier?.fullName}</span></div><strong className="text-[#1e50b3]">{formatCurrency(sale.payableAmount)}</strong></div><p className="mt-1 text-xs text-slate-600">{sale.items.map((item: any) => `${item.product.name} × ${item.quantity}`).join(", ")}</p><p className="mt-2 text-xs text-emerald-700">+{sale.loyaltyPointsEarned} ball · ishlatilgan {sale.loyaltyPointsUsed} ball</p>{sale.returns?.map((item: any) => <p key={item.id} className="mt-1 text-xs text-red-700">Qaytarildi: {formatCurrency(item.totalRefundAmount)} · ball o‘zgarishi {item.loyaltyPointsRestored - item.loyaltyPointsReversed}</p>)}</article>) : <p className="text-sm text-slate-500">Hozircha xarid yo‘q.</p>}</div></>}</section></div>}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Yangi Mijoz Qo‘shish</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700">Mijoz Ismi *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Masalan: Sardor Rahimov"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs md:text-sm focus:border-[#1e50b3] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Telefon Raqami</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+998 90 123 45 67"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs md:text-sm focus:border-[#1e50b3] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Izoh</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Doimiy xaridor..."
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs md:text-sm focus:border-[#1e50b3] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#1e50b3] px-5 py-2 text-xs font-bold text-white hover:bg-[#123d99] disabled:opacity-50"
                >
                  {isSubmitting ? "Saqlanmoqda..." : "Saqlash"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
