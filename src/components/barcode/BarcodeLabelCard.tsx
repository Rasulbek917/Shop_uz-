"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import BarcodeRenderer from "./BarcodeRenderer";
import { formatCurrency } from "@/lib/formatters";
import { Download, Printer, Check, Copy } from "lucide-react";

interface BarcodeLabelCardProps {
  product: {
    id?: string;
    sku?: string | null;
    name: string;
    salePrice: number;
    shopName?: string;
    barcodeType?: "QR" | "CODE128" | "EAN13";
    barcode?: string | null;
    qrCode?: string | null;
    brand?: string | null;
    category?: { name: string } | string | null;
    manufacturer?: { name: string } | string | null;
  };
  onPrint?: () => void;
  showActions?: boolean;
}

export default function BarcodeLabelCard({
  product,
  onPrint,
  showActions = true,
}: BarcodeLabelCardProps) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine code and type
  const effectiveType = product.barcodeType || (product.qrCode && !product.barcode ? "QR" : "CODE128");
  const codeValue =
    effectiveType === "QR"
      ? (product.qrCode || product.barcode || product.sku || "")
      : (product.barcode || product.sku || product.qrCode || "");

  const skuDisplay = product.sku || product.barcode || product.qrCode || "SM-CODE";
  const categoryName =
    typeof product.category === "object" ? product.category?.name : product.category;
  const brandName =
    typeof product.manufacturer === "object" ? product.manufacturer?.name : product.manufacturer || product.brand;

  const handleDownloadPng = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${skuDisplay}_${effectiveType}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDirectPrint = () => {
    if (onPrint) {
      onPrint();
      return;
    }

    const cleanup = () => {
      document.body.classList.remove("printing-barcode-label");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    document.body.classList.add("printing-barcode-label");

    // Open print dialog targeted for thermal printer
    setTimeout(() => {
      window.print();
    }, 50);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col items-center max-w-sm w-full mx-auto">
      {/* Printable Label Box (configured for 80mm / thermal printers) */}
      <div className="print-label-area barcode-print-container w-full border-2 border-dashed border-slate-300 rounded-xl p-3 bg-white flex flex-col items-center text-center">
        {/* Header: Store Name */}
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-0.5 truncate max-w-full">
          {product.shopName || "SHOP MARKET"}
        </div>

        {/* Product Name */}
        <div className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 mb-1 px-1">
          {product.name}
        </div>

        {/* Brand / Category */}
        {(brandName || categoryName) && (
          <div className="text-[10px] text-slate-400 font-medium mb-1">
            {[brandName, categoryName].filter(Boolean).join(" • ")}
          </div>
        )}

        {/* Barcode / QR Image */}
        <div className="my-1 flex items-center justify-center">
          <BarcodeRenderer
            type={effectiveType as any}
            value={codeValue}
            width={effectiveType === "QR" ? 140 : 1.8}
            height={effectiveType === "QR" ? 110 : 55}
            onDataUrlReady={setDataUrl}
            className="border-0 shadow-none p-1"
          />
        </div>

        {/* SKU & Price */}
        <div className="w-full mt-2 pt-2 border-t border-slate-100 flex items-center justify-between px-2">
          <div className="text-left">
            <span className="block text-[9px] uppercase font-bold text-slate-400">SKU / Kod</span>
            <span className="font-mono text-xs font-bold text-slate-800">{skuDisplay}</span>
          </div>
          <div className="text-right">
            <span className="block text-[9px] uppercase font-bold text-slate-400">Narx</span>
            <span className="text-sm font-extrabold text-[#16A34A]">{formatCurrency(product.salePrice)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {showActions && (
        <div className="w-full mt-3 flex items-center gap-2 no-print">
          <button
            onClick={handleCopyCode}
            type="button"
            className="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            {copied ? "Nusxalandi" : "Kodni olish"}
          </button>

          <button
            onClick={handleDownloadPng}
            disabled={!dataUrl}
            type="button"
            className="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            PNG
          </button>

          <button
            onClick={handleDirectPrint}
            type="button"
            className="flex-1 py-2 px-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Chop etish
          </button>
        </div>
      )}

      {/* Dedicated Print Container portaled directly to <body> so parent modals/wrappers cannot clip or resize it */}
      {mounted &&
        createPortal(
          <div className="barcode-thermal-print-area">
            <div className="thermal-store-name">
              {product.shopName || "SHOP MARKET"}
            </div>
            <div className="thermal-product-name">
              {product.name}
            </div>
            {(brandName || categoryName) && (
              <div className="thermal-product-sub">
                {[brandName, categoryName].filter(Boolean).join(" • ")}
              </div>
            )}
            <div className="thermal-code-wrapper">
              <BarcodeRenderer
                type={effectiveType as any}
                value={codeValue}
                width={effectiveType === "QR" ? 120 : 1.6}
                height={effectiveType === "QR" ? 95 : 45}
                displayValue={true}
                className="border-0 shadow-none p-0"
              />
            </div>
            <div className="thermal-bottom-row">
              <span className="thermal-sku">{skuDisplay}</span>
              <span className="thermal-price">{formatCurrency(product.salePrice)}</span>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
