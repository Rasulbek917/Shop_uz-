"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ScanLine,
  Camera,
  Keyboard,
  Package,
  AlertCircle,
  CheckCircle2,
  ShoppingCart,
  Layers,
  ArrowRight,
  RefreshCw,
  X,
} from "lucide-react";
import BarcodeNav from "@/components/barcode/BarcodeNav";
import { Html5Qrcode } from "html5-qrcode";
import { formatCurrency, formatDate } from "@/lib/formatters";
import BarcodeLabelCard from "@/components/barcode/BarcodeLabelCard";

export default function ScannerLookupPage() {
  const [scannedCode, setScannedCode] = useState("");
  const [product, setProduct] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // USB Scanner rapid keystroke detector
  const bufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    inputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in regular text inputs
      const target = e.target as HTMLElement;
      const isRegularInput =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        if (bufferRef.current.trim().length >= 3) {
          const code = bufferRef.current.trim();
          bufferRef.current = "";
          setScannedCode(code);
          lookupProduct(code);
        } else {
          bufferRef.current = "";
        }
        return;
      }

      if (e.key.length === 1) {
        if (timeDiff > 120 && !isRegularInput) {
          bufferRef.current = e.key;
        } else {
          bufferRef.current += e.key;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      cleanupCamera();
    };
  }, []);

  const cleanupCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        // ignore
      }
      scannerRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setIsCameraActive(true);
    setErrorStatus(null);
    try {
      await cleanupCamera();
      const scanner = new Html5Qrcode("scanner-lookup-camera-box");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 15, qrbox: { width: 250, height: 180 } },
        (decoded) => {
          cleanupCamera();
          setScannedCode(decoded.trim());
          lookupProduct(decoded.trim());
        },
        () => {}
      );
    } catch (e: any) {
      setErrorStatus("Kameraga ulanishda xatolik: " + (e.message || "Ruxsat berilmadi"));
      setIsCameraActive(false);
    }
  };

  const lookupProduct = async (codeToSearch: string) => {
    const code = codeToSearch.trim();
    if (!code) return;

    setIsLoading(true);
    setErrorStatus(null);
    setProduct(null);

    try {
      const res = await fetch(`/api/barcode/lookup/${encodeURIComponent(code)}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorStatus(data.error?.message || `"${code}" kodi do'konda topilmadi`);
      } else {
        setProduct(data.product);
      }
    } catch (err: any) {
      setErrorStatus("Server bilan aloqa xatosi: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 1000;
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) {}
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <BarcodeNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ScanLine className="w-6 h-6 text-[#16A34A]" />
            Skaner & Tezkor Tovarni Qidirish
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            USB shtrix-kod skaneri yoki kamera orqali tovar ma'lumotlari, do'kon narxi va qoldiqlarini bir zumda tekshiring
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isCameraActive ? (
            <button
              onClick={startCamera}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 shadow-sm"
            >
              <Camera className="w-4 h-4 text-blue-600" />
              Kamera bilan skanerlash
            </button>
          ) : (
            <button
              onClick={cleanupCamera}
              className="px-3.5 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold"
            >
              Kamerani to'xtatish
            </button>
          )}
        </div>
      </div>

      {/* Camera Live View Area */}
      {isCameraActive && (
        <div className="bg-slate-950 p-4 rounded-3xl max-w-md mx-auto shadow-2xl">
          <div id="scanner-lookup-camera-box" className="w-full"></div>
          <p className="text-center text-xs text-slate-400 mt-2 font-mono">
            Kamerani shtrix-kod yoki QR-kodga yo'naltiring...
          </p>
        </div>
      )}

      {/* Input Box for USB Scanner / Keyboard */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookupProduct(scannedCode);
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Keyboard className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Shtrix-kodni USB skaner orqali o'qing yoki raqamini yozing..."
              value={scannedCode}
              onChange={(e) => setScannedCode(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 focus:border-[#16A34A] text-xs font-mono outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3 rounded-2xl bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50"
          >
            {isLoading ? "Qidirilmoqda..." : "Qidirish"}
          </button>
        </form>

        <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          USB skaner avtomatik faol holatda. Skanerni shtrix-kodga bosishingiz bilan ma'lumotlar chiqadi.
        </p>
      </div>

      {/* Error state */}
      {errorStatus && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-bold">Natija:</p>
            <p className="mt-0.5">{errorStatus}</p>
          </div>
        </div>
      )}

      {/* Found Product Result Display */}
      {product && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Tovar ombordan topildi
            </div>
            <span className="font-mono text-xs text-slate-500 font-bold">
              SKU: {product.sku}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Details */}
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 leading-tight">
                  {product.name}
                </h2>
                {(product.manufacturer?.name || product.category?.name) && (
                  <p className="text-xs text-slate-400 mt-1">
                    {[product.manufacturer?.name, product.category?.name].filter(Boolean).join(" • ")}
                  </p>
                )}
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Do'kondagi narxi:</span>
                  <span className="font-extrabold text-[#16A34A] text-base">
                    {formatCurrency(product.salePrice)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Ombordagi qoldiq:</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {product.totalStock} {product.unit || "dona"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Do'kon:</span>
                  <span className="font-medium text-slate-700">{product.shopName}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Holat:</span>
                  <span className="font-bold text-emerald-600">
                    {product.status === "ACTIVE" ? "Faol (Sotuvda)" : "Nofaol"}
                  </span>
                </div>
              </div>

              {/* Partiyalar / Batches list */}
              {product.batches?.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-700 mb-2">
                    Mavjud partiyalar ({product.batches.length} ta):
                  </h3>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {product.batches.map((b: any) => (
                      <div
                        key={b.id}
                        className="p-2 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between text-[11px]"
                      >
                        <div>
                          <span className="font-mono font-bold text-slate-800">{b.batchNumber}</span>
                          <span className="text-slate-400 ml-2">Muddati: {formatDate(b.expiryDate)}</span>
                        </div>
                        <span className="font-bold text-slate-900">{b.currentQuantity} ta</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* POS Cart Action */}
              <div className="pt-2">
                <Link
                  href="/kassir"
                  className="w-full py-3 px-4 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Kassaga o'tish va Savatga qo'shish
                </Link>
              </div>
            </div>

            {/* Label Card */}
            <div>
              <BarcodeLabelCard product={product} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
