"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  QrCode,
  Barcode,
  Sparkles,
  Package,
  Store,
  DollarSign,
  Tag,
  Layers,
  FileText,
  AlertCircle,
  CheckCircle2,
  Download,
  Printer,
  Save,
  ArrowLeft,
} from "lucide-react";
import BarcodeNav from "@/components/barcode/BarcodeNav";
import BarcodeLabelCard from "@/components/barcode/BarcodeLabelCard";
import { isValidEan13 } from "@/lib/sku";

export default function CreateBarcodePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get("editId");

  const [formData, setFormData] = useState({
    productId: editId || "",
    name: "",
    shopId: "",
    sku: "",
    salePrice: "",
    brand: "",
    category: "",
    description: "",
    codeType: "CODE128" as "CODE128" | "QR" | "EAN13",
    customBarcode: "",
  });

  const [shops, setShops] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedProduct, setSavedProduct] = useState<any | null>(null);

  useEffect(() => {
    loadMetadata();
    if (editId) {
      loadExistingProduct(editId);
    }
  }, [editId]);

  const loadMetadata = async () => {
    try {
      const [shopsRes, catRes, manRes] = await Promise.all([
        fetch("/api/shops"),
        fetch("/api/categories"),
        fetch("/api/manufacturers"),
      ]);

      const shopsData = await shopsRes.json();
      const catData = await catRes.json();
      const manData = await manRes.json();

      if (shopsData.success) {
        setShops(shopsData.data || []);
        if (shopsData.data?.length > 0 && !formData.shopId) {
          setFormData((prev) => ({ ...prev, shopId: shopsData.data[0].id }));
        }
      }
      if (catData.success) setCategories(catData.data || []);
      if (manData.success) setManufacturers(manData.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadExistingProduct = async (id: string) => {
    try {
      const res = await fetch(`/api/products/${id}`);
      const data = await res.json();
      if (data.success && data.data) {
        const p = data.data;
        const codeType = p.qrCode && !p.barcode ? "QR" : "CODE128";
        setFormData({
          productId: p.id,
          name: p.name,
          shopId: p.shopId || "",
          sku: p.barcode || p.qrCode || "",
          salePrice: String(p.salePrice || 0),
          brand: p.manufacturer?.name || "",
          category: p.category?.name || "",
          description: p.description || "",
          codeType: codeType as any,
          customBarcode: p.barcode || p.qrCode || "",
        });
      }
    } catch (e) {
      console.error("Load product error:", e);
    }
  };

  // EAN-13 validation check
  const isEan = formData.codeType === "EAN13";
  const eanWarning =
    isEan &&
    formData.customBarcode &&
    !isValidEan13(formData.customBarcode.replace(/\D/g, ""))
      ? "EAN-13 kodi 13 ta raqam va to'g'ri nazorat sonidan iborat bo'lishi kerak. Bo'sh qoldirsangiz, tizim avtomatik to'g'ri EAN-13 hosil qiladi."
      : null;

  // Live preview value
  const previewCode =
    formData.customBarcode.trim() ||
    formData.sku.trim() ||
    (isEan ? "2000000000017" : "SM-000001");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("Mahsulot nomini kiritish majburiy");
      return;
    }

    const priceNum = parseFloat(formData.salePrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setError("Mahsulot narxi to'g'ri kiritilishi shart (musbat son)");
      return;
    }

    if (
      isEan &&
      formData.customBarcode &&
      !isValidEan13(formData.customBarcode.replace(/\D/g, ""))
    ) {
      setError("Kiritilgan EAN-13 kodi yaroqsiz! EAN-13 tekshiruvini o'tmadi.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/barcode/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: formData.productId || undefined,
          name: formData.name.trim(),
          shopId: formData.shopId || undefined,
          sku: formData.sku.trim() || undefined,
          salePrice: priceNum,
          brand: formData.brand.trim() || undefined,
          category: formData.category.trim() || undefined,
          description: formData.description.trim() || undefined,
          codeType: formData.codeType,
          customBarcode: formData.customBarcode.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error?.message || "Kod saqlashda xatolik yuz berdi");
      } else {
        setSavedProduct(data.product);
      }
    } catch (err: any) {
      setError("Server bilan aloqa xatosi: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSavedProduct(null);
    setFormData({
      productId: "",
      name: "",
      shopId: shops[0]?.id || "",
      sku: "",
      salePrice: "",
      brand: "",
      category: "",
      description: "",
      codeType: "CODE128",
      customBarcode: "",
    });
    setError(null);
    if (editId) {
      router.push("/admin/shtrix-kodlar/yaratish");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Sub Navigation */}
      <BarcodeNav />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#16A34A]" />
            {editId ? "Shtrix-kodni Tahrirlash" : "Yangi Shtrix-kod Yaratish"}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Do'kon tovarlari uchun Code 128, QR kod yoki EAN-13 generatsiya qiling va etiketkasini oling
          </p>
        </div>

        <button
          onClick={() => router.back()}
          className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Orqaga
        </button>
      </div>

      {/* Saved Result Display */}
      {savedProduct && (
        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-[#16A34A] text-white flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-emerald-950">
                Shtrix-kod Muvaffaqiyatli Saqlandi!
              </h2>
              <p className="text-xs text-emerald-800">
                Mahsulot: <span className="font-bold">{savedProduct.name}</span> | Kod: <span className="font-mono font-bold">{savedProduct.barcodeValue}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div>
              <BarcodeLabelCard product={savedProduct} />
            </div>

            <div className="space-y-3">
              <div className="bg-white/95 rounded-2xl p-4 border border-emerald-200 text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Mahsulot nomi:</span>
                  <span className="font-bold text-slate-900">{savedProduct.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Kod / SKU:</span>
                  <span className="font-mono font-bold text-slate-900">{savedProduct.barcodeValue}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Kod formati:</span>
                  <span className="font-semibold text-slate-800">{savedProduct.barcodeType}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Do'kon:</span>
                  <span className="font-medium text-slate-800">{savedProduct.shopName}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 px-4 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
                >
                  Yana boshqa kod yaratish
                </button>
                <button
                  onClick={() => router.push("/admin/shtrix-kodlar")}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Katalogga o'tish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Form and Preview */}
      {!savedProduct && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-5"
          >
            {error && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
                <div>
                  <p className="font-bold">Xatolik</p>
                  <p className="mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* Product Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Mahsulot nomi <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Package className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Masalan: Pepsi 1.5L yoki Qora Choy"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#16A34A] text-xs outline-none"
                />
              </div>
            </div>

            {/* Store and Price */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Do'kon / Filial
                </label>
                <div className="relative">
                  <Store className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <select
                    value={formData.shopId}
                    onChange={(e) => setFormData({ ...formData, shopId: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#16A34A] text-xs outline-none bg-white font-medium"
                  >
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Sotuv narxi (so'm) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="number"
                    required
                    min="0"
                    step="100"
                    placeholder="15000"
                    value={formData.salePrice}
                    onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#16A34A] text-xs font-bold outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Brand and Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Brend / Ishlab chiqaruvchi (ixtiyoriy)
                </label>
                <div className="relative">
                  <Tag className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Coca-Cola, Nestle, Artel..."
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#16A34A] text-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Kategoriya (ixtiyoriy)
                </label>
                <div className="relative">
                  <Layers className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Ichimliklar, Oziq-ovqat..."
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#16A34A] text-xs outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Code Type Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Kod turi <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, codeType: "CODE128" })}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 ${
                    formData.codeType === "CODE128"
                      ? "border-[#16A34A] bg-emerald-50 text-[#16A34A] ring-2 ring-emerald-500 font-bold"
                      : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  <Barcode className="w-5 h-5 text-[#16A34A]" />
                  <span className="text-xs">Code 128</span>
                  <span className="text-[10px] text-slate-400">Standart USB skaner</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, codeType: "QR" })}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 ${
                    formData.codeType === "QR"
                      ? "border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-500 font-bold"
                      : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  <QrCode className="w-5 h-5 text-blue-600" />
                  <span className="text-xs">QR Code</span>
                  <span className="text-[10px] text-slate-400">Kamera & 2D</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, codeType: "EAN13" })}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 ${
                    formData.codeType === "EAN13"
                      ? "border-purple-600 bg-purple-50 text-purple-900 ring-2 ring-purple-500 font-bold"
                      : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  <Barcode className="w-5 h-5 text-purple-600" />
                  <span className="text-xs">EAN-13</span>
                  <span className="text-[10px] text-slate-400">13 ta raqam</span>
                </button>
              </div>
            </div>

            {/* Custom Barcode or Auto SKU */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Unikal SKU (ixtiyoriy)
                </label>
                <input
                  type="text"
                  placeholder="Bo'sh qolsa: SM-000001 avtomatik"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-[#16A34A] text-xs font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Maxsus shtrix-kod raqami (ixtiyoriy)
                </label>
                <input
                  type="text"
                  placeholder={isEan ? "13 ta raqam (EAN-13)" : "Zavod shtrix-kodi"}
                  value={formData.customBarcode}
                  onChange={(e) => setFormData({ ...formData, customBarcode: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-[#16A34A] text-xs font-mono outline-none"
                />
              </div>
            </div>

            {eanWarning && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{eanWarning}</span>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Qo'shimcha tavsif (ixtiyoriy)
              </label>
              <textarea
                rows={2}
                placeholder="Mahsulot haqida eslatma..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-[#16A34A] text-xs outline-none"
              />
            </div>

            {/* Action Buttons: GENERATE, Cancel */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push("/admin/shtrix-kodlar")}
                className="px-5 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Bekor qilish
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-extrabold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {isSubmitting ? "Saqlanmoqda..." : "GENERATE VA SAQLASH"}
              </button>
            </div>
          </form>

          {/* Live Preview Card */}
          <div className="space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-bold text-slate-900 text-sm mb-1">
                Jonli Ko'rinish (Preview)
              </h3>
              <p className="text-[11px] text-slate-400 mb-4">
                Chop etiladigan etiketka ko'rinishi
              </p>

              <BarcodeLabelCard
                product={{
                  name: formData.name || "Mahsulot nomi",
                  salePrice: parseFloat(formData.salePrice) || 0,
                  sku: formData.sku || previewCode,
                  shopName: shops.find((s) => s.id === formData.shopId)?.name || "SHOP MARKET",
                  barcodeType: formData.codeType,
                  barcode: formData.codeType !== "QR" ? previewCode : null,
                  qrCode: formData.codeType === "QR" ? previewCode : null,
                  brand: formData.brand || null,
                  category: formData.category || null,
                }}
                showActions={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
