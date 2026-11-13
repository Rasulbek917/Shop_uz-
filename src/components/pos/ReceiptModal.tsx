"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { Printer, Check, X, AlertTriangle, RefreshCw, Cpu, FileText } from "lucide-react";
import { formatCurrency, formatDateTime, getPaymentMethodLabel } from "@/lib/formatters";
import {
  generateEscPosBytes,
  printDirectWebSerial,
  printViaLocalBridge,
  PaperWidth,
} from "@/lib/escpos";

interface ReceiptItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: {
    id?: string;
    receiptNumber: string;
    shopName: string;
    shopPhone?: string;
    shopAddress?: string;
    cashierName: string;
    createdAt?: string;
    totalAmount: number;
    discountAmount: number;
    taxRate?: number;
    taxAmount?: number;
    payableAmount: number;
    paidAmount: number;
    changeAmount: number;
    paymentMethod: string;
    items: ReceiptItem[];
  } | null;
  isReprint?: boolean;
}

export default function ReceiptModal({ isOpen, onClose, receipt, isReprint = false }: ReceiptModalProps) {
  const [paperWidth, setPaperWidth] = useState<PaperWidth>("58mm");
  const [isPrintingEscPos, setIsPrintingEscPos] = useState(false);
  const [printStatus, setPrintStatus] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const [qrUrl, setQrUrl] = useState("");
  const receiptNumber = receipt?.receiptNumber;
  useEffect(() => {
    if (!receiptNumber) return;
    QRCode.toDataURL(receiptNumber, { margin: 0, width: 240, errorCorrectionLevel: "M" })
      .then(setQrUrl)
      .catch(() => setQrUrl(""));
  }, [receiptNumber]);

  if (!isOpen || !receipt) return null;

  // 1. Direct ESC/POS printing (Web Serial / USB / Local Bridge)
  const handleDirectEscPosPrint = async () => {
    setIsPrintingEscPos(true);
    setPrintStatus({ type: "info", message: "Termal printerga ulanmoqda..." });

    try {
      const bytes = generateEscPosBytes(
        {
          receiptNumber: receipt.receiptNumber,
          shopName: receipt.shopName,
          shopPhone: receipt.shopPhone,
          shopAddress: receipt.shopAddress,
          cashierName: receipt.cashierName,
          createdAt: receipt.createdAt,
          totalAmount: receipt.totalAmount,
          discountAmount: receipt.discountAmount,
          taxRate: receipt.taxRate,
          taxAmount: receipt.taxAmount,
          payableAmount: receipt.payableAmount,
          paidAmount: receipt.paidAmount,
          changeAmount: receipt.changeAmount,
          paymentMethod: receipt.paymentMethod,
          items: receipt.items,
        },
        { paperWidth, openDrawer: receipt.paymentMethod === "CASH", cutPaper: true, qrData: receipt.receiptNumber }
      );

      // Try local bridge first (fastest and most reliable for POS terminals)
      const bridgeRes = await printViaLocalBridge(bytes);
      if (bridgeRes.success) {
        setPrintStatus({ type: "success", message: bridgeRes.message });
        setIsPrintingEscPos(false);
        return;
      }

      // If no local bridge, try Web Serial API
      const serialRes = await printDirectWebSerial(bytes);
      if (serialRes.success) {
        setPrintStatus({ type: "success", message: serialRes.message });
      } else {
        setPrintStatus({
          type: "error",
          message: `To‘g‘ridan-to‘g‘ri termal printerga ulanib bo‘lmadi: ${serialRes.message}. Brauzer printeri orqali chop etishdan foydalanishingiz mumkin.`,
        });
      }
    } catch (err: any) {
      setPrintStatus({
        type: "error",
        message: "Termal printer xatoligi. Savdo saqlangan, lekin chek chiqarilmadi.",
      });
    } finally {
      setIsPrintingEscPos(false);
    }
  };

  // 2. Standard Browser Print (Continuous Thermal Receipt)
  const handleStandardPrint = () => {
    const widthClass = paperWidth === "58mm" ? "receipt-58" : "receipt-80";
    const cleanup = () => document.body.classList.remove("printing-receipt", "receipt-58", "receipt-80");
    document.body.classList.add("printing-receipt", widthClass);
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header Actions */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3.5 no-print">
          <span className="text-xs font-bold uppercase tracking-wider text-primary-700 flex items-center gap-1.5">
            <Check className="h-4 w-4" />
            {isReprint ? "Chekni Qayta Chop Etish" : "Sotuv Muvaffaqiyatli"}
          </span>

          <div className="flex items-center gap-2">
            {/* Paper Width Toggle */}
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setPaperWidth("58mm")}
                className={`rounded px-1.5 py-0.5 transition-colors ${
                  paperWidth === "58mm" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                58 mm
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth("80mm")}
                className={`rounded px-1.5 py-0.5 transition-colors ${
                  paperWidth === "80mm" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                80 mm
              </button>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printer Status Banner if any */}
        {printStatus && (
          <div
            className={`px-4 py-2.5 text-xs font-medium no-print flex items-center justify-between ${
              printStatus.type === "success"
                ? "bg-primary-50 text-primary-800 border-b border-primary-100"
                : printStatus.type === "error"
                ? "bg-amber-50 text-amber-900 border-b border-amber-200"
                : "bg-blue-50 text-blue-800 border-b border-blue-100"
            }`}
          >
            <div className="flex items-center gap-2">
              {printStatus.type === "error" && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />}
              {printStatus.type === "success" && <Check className="h-4 w-4 shrink-0 text-primary-600" />}
              <span>{printStatus.message}</span>
            </div>
            {printStatus.type === "error" && (
              <button
                onClick={handleDirectEscPosPrint}
                className="ml-2 text-xs font-bold text-amber-800 underline hover:text-amber-900"
              >
                Qayta urinish
              </button>
            )}
          </div>
        )}

        {/* Printable Thermal Receipt Container */}
        <div
          className={`p-6 bg-white max-h-[65vh] overflow-y-auto transition-all ${
            paperWidth === "58mm" ? "max-w-[280px] mx-auto text-[11px]" : "max-w-full text-xs"
          }`}
        >
          {/* Shop Header */}
          <div className="text-center border-b border-dashed border-slate-300 pb-3">
            <h2 className="text-sm md:text-base font-extrabold tracking-tight text-slate-900 uppercase">
              {receipt.shopName}
            </h2>
            {receipt.shopAddress && (
              <p className="text-[10px] text-slate-500 mt-0.5">{receipt.shopAddress}</p>
            )}
            {receipt.shopPhone && (
              <p className="text-[10px] text-slate-500">Tel: {receipt.shopPhone}</p>
            )}
          </div>

          {/* Receipt Info */}
          <div className="py-2.5 text-[11px] text-slate-600 border-b border-dashed border-slate-300 space-y-0.5">
            <div className="flex justify-between">
              <span>Chek raqami:</span>
              <span className="font-bold text-slate-900">{receipt.receiptNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Sana va vaqt:</span>
              <span>{formatDateTime(receipt.createdAt || new Date())}</span>
            </div>
            <div className="flex justify-between">
              <span>Kassir:</span>
              <span className="font-medium text-slate-800">{receipt.cashierName}</span>
            </div>
            <div className="flex justify-between">
              <span>To‘lov turi:</span>
              <span className="font-medium text-slate-800">
                {getPaymentMethodLabel(receipt.paymentMethod)}
              </span>
            </div>
            {isReprint && (
              <div className="text-center font-bold text-amber-600 text-[10px] pt-1">
                * NUSXA / QAYTA CHOP ETILGAN CHEK *
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="py-3 border-b border-dashed border-slate-300">
            <div className="flex justify-between text-[11px] font-bold text-slate-900 mb-1.5">
              <span>Mahsulot</span>
              <span>Summa</span>
            </div>

            <div className="space-y-2 text-[11px]">
              {receipt.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start">
                  <div className="pr-2">
                    <p className="font-semibold text-slate-800">{item.productName}</p>
                    <p className="text-[10px] text-slate-500">
                      {formatCurrency(item.unitPrice)} × {item.quantity}
                      {item.discount > 0 && ` (-${formatCurrency(item.discount)})`}
                    </p>
                  </div>
                  <span className="font-bold text-slate-900 shrink-0">
                    {formatCurrency(item.totalPrice)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Calculations Summary */}
          <div className="pt-3 text-[11px] space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Jami qiymat:</span>
              <span>{formatCurrency(receipt.totalAmount)}</span>
            </div>

            {receipt.discountAmount > 0 && (
              <div className="flex justify-between text-red-600 font-semibold">
                <span>Chegirma:</span>
                <span>-{formatCurrency(receipt.discountAmount)}</span>
              </div>
            )}

            {!!receipt.taxAmount && receipt.taxAmount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>QQS{receipt.taxRate ? ` (${receipt.taxRate}%)` : ""}:</span>
                <span>{formatCurrency(receipt.taxAmount)}</span>
              </div>
            )}

            <div className="flex justify-between text-xs md:text-sm font-extrabold text-slate-900 pt-1 border-t border-slate-200">
              <span>To‘lov summasi:</span>
              <span className="text-primary-700">{formatCurrency(receipt.payableAmount)}</span>
            </div>

            <div className="flex justify-between text-slate-600 pt-1 text-[11px]">
              <span>Qabul qilindi:</span>
              <span>{formatCurrency(receipt.paidAmount)}</span>
            </div>

            {receipt.changeAmount > 0 && (
              <div className="flex justify-between text-slate-800 font-bold text-[11px]">
                <span>Qaytim:</span>
                <span>{formatCurrency(receipt.changeAmount)}</span>
              </div>
            )}
          </div>

          {/* Footer message */}
          <div className="mt-5 text-center text-[10px] text-slate-400 border-t border-dashed border-slate-200 pt-3">
            <p>Xaridingiz uchun tashakkur!</p>
            <p className="mt-0.5 font-medium text-slate-500">Salomat bo‘ling!</p>
            {qrUrl && <img src={qrUrl} alt="Chek QR kodi" className="mx-auto mt-2 h-20 w-20" style={{ imageRendering: "pixelated" }} />}
          </div>
        </div>

        {/* Modal Action Buttons Footer */}
        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50 p-4 no-print">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleDirectEscPosPrint}
              disabled={isPrintingEscPos}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-3 py-2 text-xs font-bold text-white hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50"
            >
              <Cpu className="h-4 w-4" />
              <span>{isPrintingEscPos ? "Yuborilmoqda..." : "ESC/POS Termal"}</span>
            </button>

            <button
              onClick={handleStandardPrint}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-sm"
            >
              <Printer className="h-4 w-4" />
              <span>Standart Chop</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors shadow-sm"
          >
            Yopish va yangi sotuvga o‘tish
          </button>
        </div>
      </div>
    </div>
    {createPortal(
      <PrintReceipt receipt={receipt} qrUrl={qrUrl} isReprint={isReprint} />,
      document.body
    )}
    </>
  );
}

// Faqat chop etishda ko'rinadigan chek (58 mm / 80 mm termal printer uchun). <body> ga portal qilinadi.
function PrintReceipt({ receipt, qrUrl, isReprint }: { receipt: NonNullable<ReceiptModalProps["receipt"]>; qrUrl: string; isReprint: boolean }) {
  const f = (n: number) => formatCurrency(n);
  return (
    <div className="receipt-print-area">
      <div className="rp-center rp-shop">{receipt.shopName}</div>
      {receipt.shopAddress && <div className="rp-center">{receipt.shopAddress}</div>}
      {receipt.shopPhone && <div className="rp-center">Tel: {receipt.shopPhone}</div>}
      <hr className="rp-line" />
      <div className="rp-wrap">Chek: {receipt.receiptNumber}</div>
      <div>{formatDateTime(receipt.createdAt || new Date())}</div>
      <div>Kassir: {receipt.cashierName}</div>
      <div>To‘lov: {getPaymentMethodLabel(receipt.paymentMethod)}</div>
      {isReprint && <div className="rp-center rp-bold">* NUSXA *</div>}
      <hr className="rp-line" />
      {receipt.items.map((item, i) => (
        <div key={i} className="rp-item">
          <div className="rp-name">{item.productName}</div>
          <div className="rp-row"><span>{item.quantity} x {f(item.unitPrice)}</span><span>{f(item.totalPrice)}</span></div>
          {item.discount > 0 && <div className="rp-row"><span>Chegirma</span><span>-{f(item.discount)}</span></div>}
        </div>
      ))}
      <hr className="rp-line" />
      <div className="rp-row"><span>Jami:</span><span>{f(receipt.totalAmount)}</span></div>
      {receipt.discountAmount > 0 && <div className="rp-row"><span>Chegirma:</span><span>-{f(receipt.discountAmount)}</span></div>}
      {!!receipt.taxAmount && receipt.taxAmount > 0 && <div className="rp-row"><span>QQS{receipt.taxRate ? ` ${receipt.taxRate}%` : ""}:</span><span>{f(receipt.taxAmount)}</span></div>}
      <div className="rp-row rp-total"><span>TO‘LOV:</span><span>{f(receipt.payableAmount)}</span></div>
      <div className="rp-row"><span>Qabul qilindi:</span><span>{f(receipt.paidAmount)}</span></div>
      {receipt.changeAmount > 0 && <div className="rp-row rp-bold"><span>Qaytim:</span><span>{f(receipt.changeAmount)}</span></div>}
      <hr className="rp-line" />
      <div className="rp-center">Xaridingiz uchun tashakkur!</div>
      {qrUrl && (
        <div className="rp-center">
          <img className="rp-qr" src={qrUrl} alt="" />
          <div className="rp-small">{receipt.receiptNumber}</div>
        </div>
      )}
    </div>
  );
}
