"use client";

import React, { useEffect, useState } from "react";
import { CreditCard, PencilLine, Plus, Search, Trash2, X, Banknote, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { getErrorMessage } from "@/lib/errorMessage";

const emptyForm = {
  firstName: "",
  lastName: "",
  phone: "",
  amount: 0,
  description: "",
};

export default function DebtsPage() {
  const [debts, setDebts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [payingDebt, setPayingDebt] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);

  useEffect(() => {
    loadDebts();
  }, []);

  const loadDebts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/debts");
      const data = await res.json();
      if (data.success) {
        setDebts(data.data || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const url = editingDebtId ? `/api/debts/${editingDebtId}` : "/api/debts";
      const method = editingDebtId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          amount: Number(formData.amount || 0),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(getErrorMessage(data.error, "Xatolik yuz berdi"));
        return;
      }

      setSuccessMsg(data.message);
      setShowAddModal(false);
      setFormData(emptyForm);
      setEditingDebtId(null);
      loadDebts();
    } catch (error) {
      setErrorMsg("Server xatosi");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenPay = (debt: any) => {
    setPayingDebt(debt);
    setPayAmount(Number(debt.amount || 0));
    setErrorMsg(null);
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingDebt) return;

    const amountPaid = Number(payAmount || 0);
    if (amountPaid <= 0) {
      alert("Iltimos, to‘langan summani kiriting!");
      return;
    }

    const currentAmount = Number(payingDebt.amount || 0);
    const newAmount = Math.max(0, currentAmount - amountPaid);
    const newStatus = newAmount === 0 ? "PAID" : "OPEN";

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/debts/${payingDebt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: newAmount,
          status: newStatus,
          description: payingDebt.description
            ? `${payingDebt.description} | [${new Date().toLocaleDateString("uz-UZ")} to'landi: ${amountPaid.toLocaleString("uz-UZ")} so'm]`
            : `[${new Date().toLocaleDateString("uz-UZ")} to'landi: ${amountPaid.toLocaleString("uz-UZ")} so'm]`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(getErrorMessage(data.error, "To‘lovni qayd etishda xatolik yuz berdi"));
        return;
      }

      setSuccessMsg(
        newAmount === 0
          ? `Qarz to‘liq yopildi (${amountPaid.toLocaleString("uz-UZ")} so'm qabul qilindi)!`
          : `Qarzdan ${amountPaid.toLocaleString("uz-UZ")} so'm to‘landi. Qolgan qarz: ${newAmount.toLocaleString("uz-UZ")} so'm.`
      );
      setPayingDebt(null);
      loadDebts();
    } catch (err) {
      setErrorMsg("Server bilan bog‘lanishda xatolik");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (debt: any) => {
    setEditingDebtId(debt.id);
    setFormData({
      firstName: debt.firstName || "",
      lastName: debt.lastName || "",
      phone: debt.phone || "",
      amount: Number(debt.amount || 0),
      description: debt.description || "",
    });
    setShowAddModal(true);
  };

  const handleDelete = async (debtId: string) => {
    if (!confirm("Ushbu qarzni o‘chirishni xohlaysizmi?")) return;

    try {
      const res = await fetch(`/api/debts/${debtId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(getErrorMessage(data.error, "Qarzni o‘chirishda xatolik yuz berdi"));
        return;
      }

      setSuccessMsg(data.message);
      loadDebts();
    } catch (error) {
      setErrorMsg("Server xatosi");
    }
  };

  const filtered = debts.filter((debt) => {
    const fullName = `${debt.firstName || ""} ${debt.lastName || ""}`.toLowerCase();
    return (
      fullName.includes(search.toLowerCase()) ||
      (debt.phone && debt.phone.includes(search)) ||
      (debt.description && debt.description.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const totalDebt = debts.reduce((sum, debt) => sum + (debt.status === "OPEN" ? Number(debt.amount || 0) : 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
            Qarzlar Boshqaruvi
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Mijozlar va boshqa shaxslar qarzi, miqdori va tavsifi
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-800">
            <span>Jami Qarz: </span>
            <span className="text-sm font-extrabold">{formatCurrency(totalDebt)}</span>
          </div>

          <button
            onClick={() => {
              setErrorMsg(null);
              setSuccessMsg(null);
              setEditingDebtId(null);
              setFormData(emptyForm);
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-[#16A34A] px-4 py-2.5 text-xs md:text-sm font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-[#15803D]"
          >
            <Plus className="h-4 w-4" />
            <span>Qarz Qo‘shish</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>×</button>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <X className="h-4 w-4" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)}>×</button>
        </div>
      )}

      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ism, familiya, telefon yoki tavsif bo‘yicha qidirish..."
          className="w-full text-xs md:text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Ism / Familiya</th>
                <th className="px-4 py-3.5">Telefon</th>
                <th className="px-4 py-3.5">Qarz Miqdori</th>
                <th className="px-4 py-3.5">Tavsif</th>
                <th className="px-4 py-3.5">Holat</th>
                <th className="px-5 py-3.5 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-slate-400">
                    Yuklanmoqda...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-slate-400">
                    Qarzlar topilmadi.
                  </td>
                </tr>
              ) : (
                filtered.map((debt) => (
                  <tr key={debt.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-900 text-sm">
                      {debt.firstName} {debt.lastName}
                    </td>

                    <td className="px-4 py-3.5 font-semibold text-slate-700">
                      {debt.phone || "-"}
                    </td>

                    <td className="px-4 py-3.5 font-extrabold text-red-700 text-sm">
                      {formatCurrency(debt.amount)}
                    </td>

                    <td className="px-4 py-3.5 text-slate-600 max-w-xs">
                      {debt.description || "-"}
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                          debt.status === "PAID"
                            ? "bg-emerald-100 text-emerald-700"
                            : debt.status === "CANCELLED"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {debt.status === "PAID"
                          ? "To‘langan"
                          : debt.status === "CANCELLED"
                            ? "Bekor qilingan"
                            : "Ochilgan"}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-1.5 items-center">
                        {debt.status !== "PAID" && (
                          <button
                            type="button"
                            onClick={() => handleOpenPay(debt)}
                            className="flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors shadow-sm"
                            title="To‘lov qabul qilish"
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            <span>To‘landi</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleEdit(debt)}
                          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          title="Tahrirlash"
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(debt.id)}
                          className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100"
                          title="O‘chirish"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingDebtId ? "Qarzni Tahrirlash" : "Yangi Qarz Qo‘shish"}
              </h3>
              <button onClick={() => {
                setShowAddModal(false);
                setEditingDebtId(null);
                setFormData(emptyForm);
              }} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <X className="h-4 w-4 shrink-0 text-red-600" />
                  <span>{errorMsg}</span>
                </div>
                <button type="button" onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700">×</button>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Ism *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="Masalan: Sardor"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs md:text-sm focus:border-[#16A34A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">Familiya *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Masalan: Rahimov"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs md:text-sm focus:border-[#16A34A] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Telefon</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+998 90 123 45 67"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs md:text-sm focus:border-[#16A34A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">Qarz miqdori *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value || 0) })}
                    placeholder="500000"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs md:text-sm focus:border-[#16A34A] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Tavsif</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Qarzning sababi yoki izohi..."
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs md:text-sm focus:border-[#16A34A] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingDebtId(null);
                    setFormData(emptyForm);
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#16A34A] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                >
                  {isSubmitting ? "Saqlanmoqda..." : editingDebtId ? "Yangilash" : "Saqlash"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* To'lov Qabul Qilish Modali */}
      {payingDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Banknote className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-bold text-slate-900">
                    Qarz To‘lovini Qabul Qilish
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {payingDebt.firstName} {payingDebt.lastName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPayingDebt(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePaySubmit} className="space-y-4">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Joriy qarz miqdori:</span>
                  <span className="font-extrabold text-red-600 text-sm">
                    {formatCurrency(payingDebt.amount)}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 pt-1.5">
                  <span className="text-slate-500">To‘lovdan keyingi qoldiq:</span>
                  <span className={`font-extrabold text-sm ${
                    Math.max(0, Number(payingDebt.amount || 0) - Number(payAmount || 0)) === 0
                      ? "text-emerald-600"
                      : "text-amber-600"
                  }`}>
                    {formatCurrency(Math.max(0, Number(payingDebt.amount || 0) - Number(payAmount || 0)))}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Necha so‘m to‘ladi? *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max={payingDebt.amount}
                    required
                    value={payAmount || ""}
                    onChange={(e) => setPayAmount(Number(e.target.value || 0))}
                    placeholder="Masalan: 250000"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-[#16A34A] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setPayAmount(Number(payingDebt.amount || 0))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-slate-200 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-300"
                  >
                    To‘liq yopish
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Agar qisman to‘lasa (masalan yarmini), qolgan summa qarz sifatida saqlanib qoladi.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingDebt(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || Number(payAmount) <= 0}
                  className="flex items-center gap-1.5 rounded-xl bg-[#16A34A] px-5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-[#15803D] disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>{isSubmitting ? "Saqlanmoqda..." : "To‘lovni tasdiqlash"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
