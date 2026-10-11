"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  Plus,
  Search,
  Lock,
  Unlock,
  Trash2,
  Edit,
  Zap,
  CheckCircle,
  X,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { formatDate, getShopStatusBadge } from "@/lib/formatters";
import { getErrorMessage } from "@/lib/errorMessage";

export default function ShopsPage() {
  const searchParams = useSearchParams();
  const [shops, setShops] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(searchParams.get("yangi") === "1");
  const [createForm, setCreateForm] = useState({
    name: "",
    phone: "+998 ",
    address: "",
    adminName: "",
    adminUsername: "",
    adminPassword: "",
    subscriptionType: "MONTHLY" as "TRIAL" | "MONTHLY",
    trialDays: 7,
    subscriptionDays: 30,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit modal state
  const [editingShop, setEditingShop] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    address: "",
    adminName: "",
    adminUsername: "",
    adminPassword: "",
    notes: "",
  });
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    loadShops();
  }, []);

  const loadShops = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/shops");
      const data = await res.json();
      if (data.success) {
        setShops(data.data || []);
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
    setErrorMessage(null);

    try {
      const res = await fetch("/api/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(getErrorMessage(data.error, "Do‘konni qo‘shishda xatolik yuz berdi"));
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage(data.message || "Yangi do‘kon muvaffaqiyatli qo‘shildi!");
      setShowCreateModal(false);
      setCreateForm({
        name: "",
        phone: "+998 ",
        address: "",
        adminName: "",
        adminUsername: "",
        adminPassword: "",
        subscriptionType: "MONTHLY",
        trialDays: 7,
        subscriptionDays: 30,
      });
      loadShops();
    } catch (err) {
      setErrorMessage("Server bilan bog‘lanishda xatolik");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = async (shop: any) => {
    setEditError(null);
    setSuccessMessage(null);
    setEditingShop(shop);
    setEditForm({
      name: shop.name || "",
      phone: shop.phone || "",
      address: shop.address || "",
      adminName: shop.adminName || "",
      adminUsername: "",
      adminPassword: "",
      notes: shop.notes || "",
    });

    // Admin logini ro‘yxat javobida yo‘q — uni detail API dan olamiz
    setEditLoading(true);
    try {
      const res = await fetch(`/api/shops/${shop.id}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data?.users)) {
        const admin = data.data.users.find((u: any) => u.role === "SHOP_ADMIN");
        if (admin) {
          setEditForm((prev) => ({
            ...prev,
            adminUsername: admin.username || "",
            adminName: admin.fullName || prev.adminName,
          }));
        }
      }
    } catch (e) {
      // Login yuklanmasa ham boshqa maydonlarni tahrirlash mumkin
    } finally {
      setEditLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShop) return;
    setIsEditSubmitting(true);
    setEditError(null);

    try {
      const payload: any = {
        name: editForm.name,
        phone: editForm.phone,
        address: editForm.address,
        adminName: editForm.adminName,
        notes: editForm.notes || null,
      };
      if (editForm.adminUsername.trim()) payload.adminUsername = editForm.adminUsername.trim();
      if (editForm.adminPassword) payload.adminPassword = editForm.adminPassword;

      const res = await fetch(`/api/shops/${editingShop.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setEditError(getErrorMessage(data.error, "Saqlashda xatolik yuz berdi"));
        setIsEditSubmitting(false);
        return;
      }

      setSuccessMessage("Do‘kon ma'lumotlari muvaffaqiyatli yangilandi");
      setEditingShop(null);
      setEditForm({
        name: "",
        phone: "",
        address: "",
        adminName: "",
        adminUsername: "",
        adminPassword: "",
        notes: "",
      });
      loadShops();
    } catch (err) {
      setEditError("Server bilan bog'lanishda xatolik");
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleToggleBlock = async (shop: any) => {
    const newStatus = shop.status === "BLOCKED" ? "ACTIVE" : "BLOCKED";
    const confirmText =
      newStatus === "BLOCKED"
        ? `Haqiqatan ham "${shop.name}" do‘konini bloklamoqchimisiz?`
        : `"${shop.name}" do‘konini blokdan chiqarmoqchimisiz?`;

    if (!confirm(confirmText)) return;

    try {
      const res = await fetch(`/api/shops/${shop.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        loadShops();
      } else {
        alert(getErrorMessage(data.error, "Xatolik yuz berdi"));
      }
    } catch (e) {
      alert("Server xatosi");
    }
  };

  const handleActivateSubscription = async (shop: any) => {
    if (!confirm(`"${shop.name}" uchun 30 kunlik oylik obunani faollashtirib, holatini Aktiv qilmoqchimisiz?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/shops/${shop.id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationDays: 30, price: 350000 }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        loadShops();
      } else {
        alert(getErrorMessage(data.error, "Xatolik yuz berdi"));
      }
    } catch (e) {
      alert("Server xatosi");
    }
  };

  const handleDelete = async (shop: any) => {
    if (!confirm(`DIQQAT: "${shop.name}" do‘konini o‘chirmoqchimisiz?`)) return;

    try {
      const res = await fetch(`/api/shops/${shop.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        loadShops();
      }
    } catch (e) {
      alert("Server xatosi");
    }
  };

  const filteredShops = shops.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.adminName.toLowerCase().includes(search.toLowerCase()) ||
      p.phone.includes(search);

    if (filterStatus === "ALL") return matchesSearch;
    return matchesSearch && p.status === filterStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
            Do‘konlar Boshqaruvi
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Yangi do‘konlar qo‘shish, obunalarni faollashtirish va bloklash
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#16A34A] px-4 py-2.5 text-xs md:text-sm font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-[#15803D] transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Yangi Do‘kon Qo‘shish</span>
        </button>
      </div>

      {/* Success banner */}
      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Do‘kon nomi, admin yoki telefon bo‘yicha qidirish..."
            className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2 text-xs md:text-sm text-slate-800 placeholder-slate-400 focus:border-[#16A34A] focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-[#16A34A] focus:outline-none"
          >
            <option value="ALL">Barcha holatlar</option>
            <option value="ACTIVE">Aktiv</option>
            <option value="TRIAL">Sinov (Trial)</option>
            <option value="BLOCKED">Bloklangan</option>
          </select>

          <button
            onClick={loadShops}
            className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100"
            title="Yangilash"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Shops Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Do‘kon</th>
                <th className="px-4 py-3.5">Admin & Telefon</th>
                <th className="px-4 py-3.5">Holati</th>
                <th className="px-4 py-3.5">Ro‘yxatdan o‘tgan</th>
                <th className="px-4 py-3.5">Obuna / Sinov</th>
                <th className="px-4 py-3.5">Statistika</th>
                <th className="px-5 py-3.5 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    Yuklanmoqda...
                  </td>
                </tr>
              ) : filteredShops.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    Hech qanday do‘kon topilmadi.
                  </td>
                </tr>
              ) : (
                filteredShops.map((shop) => {
                  const badge = getShopStatusBadge(shop.status);

                  return (
                    <tr key={shop.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-sm">{shop.name}</span>
                            <span className="block text-[11px] text-slate-500">{shop.address}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-slate-800">{shop.adminName}</span>
                        <span className="block text-[11px] text-slate-500">{shop.phone}</span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${badge.badgeClass}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                        {formatDate(shop.createdAt)}
                      </td>

                      <td className="px-4 py-3.5 text-[11px]">
                        {shop.status === "TRIAL" ? (
                          <div className="text-blue-700">
                            <span className="font-bold">Sinov (Trial)</span>
                            <span className="block text-slate-500">
                              Qolgan: {shop.daysRemaining} kun
                            </span>
                          </div>
                        ) : shop.status === "ACTIVE" ? (
                          <div className="text-emerald-700">
                            <span className="font-bold">Oylik Obuna</span>
                            <span className="block text-slate-500">
                              Qolgan: {shop.daysRemaining} kun
                            </span>
                          </div>
                        ) : (
                          <span className="font-bold text-red-600">Bloklangan</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-[11px] text-slate-600">
                        <span>Mahsulotlar: {shop._count?.products || 0} ta</span>
                        <span className="block">Sotuvlar: {shop._count?.sales || 0} ta</span>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit */}
                          <button
                            onClick={() => openEditModal(shop)}
                            className="rounded-lg p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                            title="Tahrirlash"
                          >
                            <Edit className="h-4 w-4" />
                          </button>

                          {/* Activate Button */}
                          <button
                            onClick={() => handleActivateSubscription(shop)}
                            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
                            title="Obunani faollashtirish (30 kun)"
                          >
                            <Zap className="h-3 w-3" />
                            <span>Faollashtirish</span>
                          </button>

                          {/* Block / Unblock */}
                          <button
                            onClick={() => handleToggleBlock(shop)}
                            className={`rounded-lg p-1.5 transition-colors ${
                              shop.status === "BLOCKED"
                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                            }`}
                            title={shop.status === "BLOCKED" ? "Blokdan chiqarish" : "Bloklash"}
                          >
                            {shop.status === "BLOCKED" ? (
                              <Unlock className="h-4 w-4" />
                            ) : (
                              <Lock className="h-4 w-4" />
                            )}
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(shop)}
                            className="rounded-lg p-1.5 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                            title="O‘chirish"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE SHOP MODAL (Section 6 & 7) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Yangi Do‘kon Qo‘shish</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Do‘kon Nomi *
                </label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="Masalan: BARAKA MARKET"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs md:text-sm text-slate-800 focus:border-[#16A34A] focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Telefon Raqami *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    placeholder="+998 90 123 45 67"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs md:text-sm text-slate-800 focus:border-[#16A34A] focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Obuna Turi *
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, subscriptionType: "TRIAL" })}
                      className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                        createForm.subscriptionType === "TRIAL"
                          ? "border-amber-500 bg-amber-50 text-amber-700 shadow-sm"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      🕐 Sinov (Trial)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, subscriptionType: "MONTHLY" })}
                      className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                        createForm.subscriptionType === "MONTHLY"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      ✅ Oylik Obuna
                    </button>
                  </div>
                  {createForm.subscriptionType === "TRIAL" ? (
                    <div className="mt-2">
                      <label className="block text-xs text-slate-500 mb-1">Sinov kunlari (1-30)</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={createForm.trialDays}
                        onChange={(e) => setCreateForm({ ...createForm, trialDays: Number(e.target.value) })}
                        className="w-full rounded-xl border border-amber-300 px-3.5 py-2 text-xs md:text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    </div>
                  ) : (
                    <div className="mt-2">
                      <label className="block text-xs text-slate-500 mb-1">Obuna kunlari (30, 60, 90, 365...)</label>
                      <input
                        type="number"
                        min="1"
                        value={createForm.subscriptionDays}
                        onChange={(e) => setCreateForm({ ...createForm, subscriptionDays: Number(e.target.value) })}
                        className="w-full rounded-xl border border-emerald-300 px-3.5 py-2 text-xs md:text-sm text-slate-800 focus:border-[#16A34A] focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
                      />
                      <p className="mt-1 text-xs text-emerald-600">Do'kon aktiv holda ochiladi</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Manzil *
                </label>
                <input
                  type="text"
                  required
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  placeholder="Toshkent sh., Yunusobod tumani..."
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs md:text-sm text-slate-800 focus:border-[#16A34A] focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
                />
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider mb-2">
                  Do‘kon Administratori Hisobi
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Administrator Ismi va Familiyasi *
                    </label>
                    <input
                      type="text"
                      required
                      value={createForm.adminName}
                      onChange={(e) => setCreateForm({ ...createForm, adminName: e.target.value })}
                      placeholder="Jasur Qosimov"
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs md:text-sm text-slate-800 focus:border-[#16A34A] focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700">
                        Admin Logini *
                      </label>
                      <input
                        type="text"
                        required
                        value={createForm.adminUsername}
                        onChange={(e) => setCreateForm({ ...createForm, adminUsername: e.target.value })}
                        placeholder="baraka_admin"
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs md:text-sm text-slate-800 focus:border-[#16A34A] focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700">
                        Admin Paroli *
                      </label>
                      <input
                        type="password"
                        required
                        value={createForm.adminPassword}
                        onChange={(e) => setCreateForm({ ...createForm, adminPassword: e.target.value })}
                        placeholder="••••••••"
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs md:text-sm text-slate-800 focus:border-[#16A34A] focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded-xl bg-[#16A34A] px-5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-[#15803D] disabled:opacity-50"
                >
                  {isSubmitting ? "Saqlanmoqda..." : createForm.subscriptionType === "TRIAL" ? "Saqlash va Sinov Boshlash" : "Saqlash va Obuna Boshlash"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SHOP MODAL */}
      {editingShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Do‘konni Tahrirlash</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingShop(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {editError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Do‘kon Nomi *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs md:text-sm text-slate-800 focus:border-[#16A34A] focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Telefon Raqami *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs md:text-sm text-slate-800 focus:border-[#16A34A] focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Manzil *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs md:text-sm text-slate-800 focus:border-[#16A34A] focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Izoh
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={2}
                  placeholder="Qo‘shimcha ma'lumot (ixtiyoriy)"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs md:text-sm text-slate-800 focus:border-[#16A34A] focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
                />
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider mb-2">
                  Do‘kon Administratori Hisobi
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Administrator Ismi va Familiyasi *
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.adminName}
                      onChange={(e) => setEditForm({ ...editForm, adminName: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs md:text-sm text-slate-800 focus:border-[#16A34A] focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Admin Logini *
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.adminUsername}
                      onChange={(e) => setEditForm({ ...editForm, adminUsername: e.target.value })}
                      disabled={editLoading}
                      placeholder={editLoading ? "Yuklanmoqda..." : "admin_login"}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs md:text-sm text-slate-800 focus:border-[#16A34A] focus:outline-none focus:ring-1 focus:ring-[#16A34A] disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Yangi Admin Paroli
                    </label>
                    <input
                      type="password"
                      value={editForm.adminPassword}
                      onChange={(e) => setEditForm({ ...editForm, adminPassword: e.target.value })}
                      placeholder="O‘zgartirmasangiz bo‘sh qoldiring"
                      autoComplete="new-password"
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs md:text-sm text-slate-800 focus:border-[#16A34A] focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Bo‘sh qoldirilsa parol o‘zgarmaydi. Yangi parol kamida 5 ta belgi bo‘lsin.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingShop(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isEditSubmitting || editLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-[#16A34A] px-5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-[#15803D] disabled:opacity-50"
                >
                  {isEditSubmitting ? "Saqlanmoqda..." : "O‘zgarishlarni Saqlash"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
