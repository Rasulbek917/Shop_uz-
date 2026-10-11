"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Save,
  CheckCircle2,
  Printer,
  Barcode,
  Volume2,
  Check,
} from "lucide-react";
import BarcodeNav from "@/components/barcode/BarcodeNav";

export default function BarcodeSettingsPage() {
  const [defaultCodeType, setDefaultCodeType] = useState<string>("CODE128");
  const [defaultLabelSize, setDefaultLabelSize] = useState<string>("58x40");
  const [skuPrefix, setSkuPrefix] = useState<string>("SM-");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  useEffect(() => {
    // Load from localStorage if present
    const savedType = localStorage.getItem("sm_barcode_type");
    const savedSize = localStorage.getItem("sm_label_size");
    const savedPrefix = localStorage.getItem("sm_sku_prefix");
    const savedSound = localStorage.getItem("sm_scan_sound");

    if (savedType) setDefaultCodeType(savedType);
    if (savedSize) setDefaultLabelSize(savedSize);
    if (savedPrefix) setSkuPrefix(savedPrefix);
    if (savedSound !== null) setSoundEnabled(savedSound === "true");
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("sm_barcode_type", defaultCodeType);
    localStorage.setItem("sm_label_size", defaultLabelSize);
    localStorage.setItem("sm_sku_prefix", skuPrefix);
    localStorage.setItem("sm_scan_sound", String(soundEnabled));

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <BarcodeNav />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#16A34A]" />
          Shtrix-kod va Etiketka Sozlamalari
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Shtrix-kod generatori, termal printer etiketkalari va skanerlash parametrlarini moslashtiring
        </p>
      </div>

      {isSaved && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Sozlamalar muvaffaqiyatli saqlandi!</span>
        </div>
      )}

      {/* Form */}
      <form
        onSubmit={handleSave}
        className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6"
      >
        {/* Default Barcode Type */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Standart shtrix-kod turi
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: "CODE128", label: "Code 128", desc: "Standart skanerlar" },
              { id: "QR", label: "QR Code", desc: "Mobil & 2D kameralar" },
              { id: "EAN13", label: "EAN-13", desc: "13 ta raqamli" },
            ].map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setDefaultCodeType(item.id)}
                className={`p-3.5 rounded-2xl border text-center transition-all ${
                  defaultCodeType === item.id
                    ? "border-[#16A34A] bg-emerald-50 text-[#16A34A] ring-2 ring-emerald-500 font-bold"
                    : "border-slate-200 hover:border-slate-300 text-slate-700"
                }`}
              >
                <div className="text-xs font-bold">{item.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Default Label Size */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Termal printer etiketka o'lchami
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: "58x40", label: "58mm × 40mm", desc: "Standart termal rulon" },
              { id: "40x30", label: "40mm × 30mm", desc: "Ixcham o'lcham" },
              { id: "80x50", label: "80mm × 50mm", desc: "Katta stiker" },
            ].map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setDefaultLabelSize(item.id)}
                className={`p-3.5 rounded-2xl border text-center transition-all ${
                  defaultLabelSize === item.id
                    ? "border-[#16A34A] bg-emerald-50 text-[#16A34A] ring-2 ring-emerald-500 font-bold"
                    : "border-slate-200 hover:border-slate-300 text-slate-700"
                }`}
              >
                <div className="text-xs font-bold">{item.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* SKU Prefix */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Avtomatik SKU prefiksi
          </label>
          <input
            type="text"
            value={skuPrefix}
            onChange={(e) => setSkuPrefix(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono outline-none focus:border-[#16A34A]"
            placeholder="SM-"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Yangi tovar yaratilganda SKU formati: <span className="font-mono font-bold text-slate-700">{skuPrefix}000001</span> ko'rinishida hosil bo'ladi.
          </p>
        </div>

        {/* Scan Sound */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-3">
            <Volume2 className="w-5 h-5 text-slate-500" />
            <div>
              <p className="text-xs font-bold text-slate-800">Skanerlashda signal ovozi</p>
              <p className="text-[11px] text-slate-400">Shtrix-kod muvaffaqiyatli o'qilganda "bip" ovozi chiqarish</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(e) => setSoundEnabled(e.target.checked)}
            className="w-5 h-5 accent-[#16A34A] rounded cursor-pointer"
          />
        </div>

        {/* Save button */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold shadow-md transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Sozlamalarni saqlash
          </button>
        </div>
      </form>
    </div>
  );
}
