"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Search,
  Camera,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  FileText,
  X,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import BarcodeScannerModal from "@/components/scanner/BarcodeScannerModal";
import UsbBarcodeDetector from "@/components/scanner/UsbBarcodeDetector";
import ReceiptModal from "@/components/pos/ReceiptModal";
import CentralProductModal from "@/components/pos/CentralProductModal";
import { CartItem } from "@/types";
import { getErrorMessage } from "@/lib/errorMessage";

type HeldCheck = { number: number; cart: CartItem[]; discountAmount: number; customerId: string; loyaltyPointsUsed: number };

export default function CashierPosPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stockOnly, setStockOnly] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [heldChecks, setHeldChecks] = useState<HeldCheck[]>([]);
  const [checkNumber, setCheckNumber] = useState(1);
  const [nextCheckNumber, setNextCheckNumber] = useState(2);
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [loyaltyPointsUsed, setLoyaltyPointsUsed] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "ELECTRONIC">("CASH");
  const [paidAmount, setPaidAmount] = useState<number>(0);

  // Checkout modal & Receipt state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showPrecheck, setShowPrecheck] = useState(false);
  const [checkoutKey, setCheckoutKey] = useState<string>("");
  const [debtKey, setDebtKey] = useState<string>("");
  const [completedReceipt, setCompletedReceipt] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Qarzga sotish (POS)
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [debtForm, setDebtForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [isProcessingDebt, setIsProcessingDebt] = useState(false);
  const [debtError, setDebtError] = useState<string | null>(null);
  const [taxSettings, setTaxSettings] = useState<{ taxRate: number; taxIncluded: boolean }>({
    taxRate: 0,
    taxIncluded: false,
  });

  // Central Product Code Center integration modal state
  const [centralProductToImport, setCentralProductToImport] = useState<any | null>(null);
  const [showCentralImportModal, setShowCentralImportModal] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProducts();
    loadCustomers();
    loadTaxSettings();
    const refreshShift = () => { fetch("/api/shifts", { cache: "no-store" }).then((r) => r.json()).then((result) => { if (result.success) setShiftOpen(result.data.some((shift: { mine: boolean; status: string }) => shift.mine && shift.status === "OPEN")); }).catch(() => {}); };
    refreshShift();
    window.addEventListener("focus", refreshShift);
    return () => window.removeEventListener("focus", refreshShift);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" }).then((response) => response.json()).then((result) => {
      if (!active || !result.success || !result.user?.id || !result.user?.shopId) return;
      const key = `savdoza-pos-drafts-${result.user.shopId}-${result.user.id}`;
      try {
        const saved = JSON.parse(sessionStorage.getItem(key) || "null");
        if (saved && Array.isArray(saved.cart) && Array.isArray(saved.heldChecks)) {
          setCart(saved.cart);
          setHeldChecks(saved.heldChecks);
          setDiscountAmount(Number(saved.discountAmount) || 0);
          setSelectedCustomerId(typeof saved.selectedCustomerId === "string" ? saved.selectedCustomerId : "");
          setLoyaltyPointsUsed(Number(saved.loyaltyPointsUsed) || 0);
          setCheckNumber(Number(saved.checkNumber) || 1);
          setNextCheckNumber(Number(saved.nextCheckNumber) || 2);
          setCheckoutKey(typeof saved.checkoutKey === "string" ? saved.checkoutKey : "");
        }
      } catch { /* Corrupt browser draft is ignored. */ }
      setDraftKey(key);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!draftKey) return;
    sessionStorage.setItem(draftKey, JSON.stringify({ cart, heldChecks, discountAmount, selectedCustomerId, loyaltyPointsUsed, checkNumber, nextCheckNumber, checkoutKey }));
  }, [draftKey, cart, heldChecks, discountAmount, selectedCustomerId, loyaltyPointsUsed, checkNumber, nextCheckNumber, checkoutKey]);

  const loadTaxSettings = async () => {
    try {
      const res = await fetch("/api/shop/settings");
      const data = await res.json();
      if (data.success && data.data) {
        setTaxSettings({
          taxRate: data.data.taxRate || 0,
          taxIncluded: data.data.taxIncluded || false,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      if (data.success) {
        setProducts(data.data || []);
      } else {
        setStatusMessage({ text: getErrorMessage(data.error, "Mahsulotlarni yuklab bo‘lmadi"), type: "error" });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await fetch("/api/customers");
      const data = await res.json();
      if (data.success) {
        setCustomers(data.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Barcode scanned by Camera or USB
  const handleBarcodeScanned = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    // 1. Check local state first
    let found = products.find(
      (m) =>
        m.barcode === trimmed ||
        m.qrCode === trimmed ||
        m.name.toLowerCase() === trimmed.toLowerCase()
    );

    // 2. If not found in current local view, query backend directly
    if (!found) {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (data.success && data.data && data.data.length > 0) {
          found = data.data.find(
            (m: any) => m.barcode === trimmed || m.qrCode === trimmed
          ) || data.data[0];

          // Add to local state cache
          setProducts((prev) => {
            if (!prev.find((m) => m.id === found.id)) {
              return [...prev, found];
            }
            return prev;
          });
        }
      } catch (e) {
        console.error("Barcode lookup error:", e);
      }
    }

    if (found) {
      addToCart(found);
    } else {
      // 3. Not found in local store: Query Product Code Center (Central Database)!
      setStatusMessage({
        text: `"${trimmed}" kodi markaziy bazadan qidirilmoqda...`,
        type: "success",
      });

      try {
        const centralRes = await fetch(`/api/products/central-lookup?code=${encodeURIComponent(trimmed)}`);
        const centralData = await centralRes.json();

        if (centralData.success && centralData.data) {
          setStatusMessage(null);
          setCentralProductToImport(centralData.data);
          setShowCentralImportModal(true);
          return;
        } else if (centralData.error?.code === "CENTRAL_API_UNAVAILABLE") {
          setStatusMessage({
            text: `Do'konda topilmadi. ${centralData.error.message}`,
            type: "error",
          });
          return;
        }
      } catch (centralErr) {
        console.error("Central product lookup failed:", centralErr);
      }

      setStatusMessage({
        text: `"${code}" kodi bo‘yicha na mahalliy omborda, na markaziy bazada mahsulot topilmadi!`,
        type: "error",
      });
    }
  };

  const handleCentralImportSuccess = (importedProduct: any, andAddToCart: boolean) => {
    // Add/update to local products state cache
    setProducts((prev) => {
      const filtered = prev.filter((p) => p.id !== importedProduct.id);
      return [importedProduct, ...filtered];
    });

    if (andAddToCart) {
      addToCart(importedProduct);
    }

    setStatusMessage({
      text: `"${importedProduct.name}" do'konga muvaffaqiyatli qabul qilindi!`,
      type: "success",
    });
  };

  // Add product to cart with FEFO batch selection
  const addToCart = (product: any) => {
    const now = new Date();

    // 1. Check if batches exist with quantity > 0
    const inStockBatches = (product.batches || []).filter(
      (b: any) => b.currentQuantity > 0
    );

    if (inStockBatches.length === 0) {
      setStatusMessage({
        text: `"${product.name}" omborda mavjud emas! Qoldiq: 0`,
        type: "error",
      });
      return;
    }

    // 2. FEFO: select the batch with the earliest expiry date among NON-EXPIRED batches
    const availableBatches = inStockBatches.filter(
      (b: any) => new Date(b.expiryDate) > now
    );

    // Block sale only if every in-stock batch is expired (Section 19)
    if (availableBatches.length === 0) {
      setStatusMessage({
        text: `DIQQAT: "${product.name}" ning ombordagi barcha partiyalari muddati tugagan! Ushbu mahsulotni sotish qat'iyan taqiqlanadi.`,
        type: "error",
      });
      return;
    }

    // Sort ascending by expiry date
    const sortedBatches = [...availableBatches].sort(
      (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
    );

    // A product may span several batches. Use the next valid batch once the
    // earliest one is already fully represented in the current check.
    const bestBatch = sortedBatches.find((batch) => {
      const reserved = cart.filter((item) => item.batchId === batch.id).reduce((sum, item) => sum + item.quantity, 0);
      return reserved < batch.currentQuantity;
    });
    if (!bestBatch) {
      setStatusMessage({ text: `"${product.name}" uchun yaroqli qoldiq savatga qo‘shib bo‘lindi.`, type: "error" });
      return;
    }
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.productId === product.id && item.batchId === bestBatch.id
      );

      if (existingIndex > -1) {
        const item = prev[existingIndex];
        const updated = [...prev];
        updated[existingIndex] = {
          ...item,
          quantity: item.quantity + 1,
          totalPrice: (item.quantity + 1) * item.unitPrice - item.discount,
        };
        return updated;
      } else {
        const newItem: CartItem = {
          productId: product.id,
          productName: product.name,
          batchId: bestBatch.id,
          batchNumber: bestBatch.batchNumber,
          expiryDate: bestBatch.expiryDate,
          unit: product.unit,
          unitPrice: product.salePrice,
          purchasePrice: bestBatch.purchasePrice,
          availableQuantity: bestBatch.currentQuantity,
          quantity: 1,
          discount: 0,
          totalPrice: product.salePrice,
        };
        return [...prev, newItem];
      }
    });
    setStatusMessage(null);
  };

  const updateQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) return;
    const item = cart[index];
    if (!item) return;
    if (newQty > item.availableQuantity) {
      setStatusMessage({ text: `Ushbu partiyada faqat ${item.availableQuantity} ta mavjud. Qolganini mahsulotdan qayta qo‘shing.`, type: "error" });
      return;
    }
    if (!Number.isInteger(newQty)) return;
    setCart((prev) => {
      const updated = [...prev];
      const item = updated[index];
      if (!item) return prev;

      updated[index] = {
        ...item,
        quantity: newQty,
        totalPrice: newQty * item.unitPrice - item.discount,
      };
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (confirm("Savatchani tozalashni xohlaysizmi?")) {
      setCart([]);
      setDiscountAmount(0);
      setStatusMessage(null);
    }
  };

  const newCheck = () => {
    if (cart.length > 0) {
      setHeldChecks((previous) => [...previous.filter((check) => check.number !== checkNumber), { number: checkNumber, cart, discountAmount, customerId: selectedCustomerId, loyaltyPointsUsed }]);
    }
    setCheckNumber(nextCheckNumber);
    setNextCheckNumber((number) => number + 1);
    setCart([]);
    setDiscountAmount(0);
    setSelectedCustomerId("");
    setLoyaltyPointsUsed(0);
    setCheckoutKey("");
  };

  const restoreCheck = (number: number) => {
    const chosen = heldChecks.find((check) => check.number === number);
    if (!chosen) return;
    setHeldChecks((previous) => [...previous.filter((check) => check.number !== number && check.number !== checkNumber), ...(cart.length > 0 ? [{ number: checkNumber, cart, discountAmount, customerId: selectedCustomerId, loyaltyPointsUsed }] : [])]);
    setCheckNumber(number);
    setCart(chosen.cart);
    setDiscountAmount(chosen.discountAmount);
    setSelectedCustomerId(chosen.customerId);
    setLoyaltyPointsUsed(chosen.loyaltyPointsUsed);
    setCheckoutKey("");
  };

  // Calculations (must mirror server-side logic in /api/sales)
  const cartSubtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const afterDiscount = Math.max(0, cartSubtotal - discountAmount);
  let taxAmount = 0;
  let cartTotal = afterDiscount;
  if (taxSettings.taxRate > 0) {
    if (taxSettings.taxIncluded) {
      taxAmount = Math.round(afterDiscount - afterDiscount / (1 + taxSettings.taxRate / 100));
    } else {
      taxAmount = Math.round(afterDiscount * (taxSettings.taxRate / 100));
      cartTotal = afterDiscount + taxAmount;
    }
  }
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  const availablePoints = Math.max(0, selectedCustomer?.loyaltyPoints || 0);
  const maxRedeemablePoints = Math.min(availablePoints, Math.max(0, Math.floor((cartTotal - 1) / 1000)));
  const payableTotal = cartTotal - loyaltyPointsUsed * 1000;

  // Open Checkout Modal
  const handleOpenCheckout = () => {
    if (!shiftOpen) { setStatusMessage({ text: "Savdodan oldin kassa smenasini oching.", type: "error" }); return; }
    if (cart.length === 0) {
      alert("Savatcha bo‘sh!");
      return;
    }
    if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount >= cartSubtotal) {
      setStatusMessage({ text: "Chegirma mahsulotlar jami summasidan kam bo‘lishi kerak.", type: "error" });
      return;
    }
    if (!checkoutKey) setCheckoutKey(`CHK_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
    setPaidAmount(payableTotal);
    setShowCheckoutModal(true);
  };

  // Submit Sale
  const handleCompleteSale = async () => {
    if (cart.length === 0 || isProcessing) return;

    if (loyaltyPointsUsed > maxRedeemablePoints) {
      alert("Mijoz ballari yoki savat summasi o‘zgargan. Ball miqdorini tekshiring.");
      return;
    }
    if (Number(paidAmount) < payableTotal) {
      alert(
        `To‘langan summa (${formatCurrency(paidAmount)}) to‘lov summasidan (${formatCurrency(
          payableTotal
        )}) kam bo‘lishi mumkin emas!`
      );
      return;
    }

    if (Number(discountAmount) > cartSubtotal) {
      alert("Chegirma savat umumiy qiymatidan oshishi mumkin emas!");
      return;
    }

    setIsProcessing(true);
    try {
      const payload = {
        customerId: selectedCustomerId || null,
        loyaltyPointsUsed,
        paymentMethod,
        discountAmount: Number(discountAmount) || 0,
        paidAmount: Number(paidAmount),
        idempotencyKey: checkoutKey,
        items: cart.map((item) => ({
          productId: item.productId,
          batchId: item.batchId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
        })),
      };

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(getErrorMessage(data.error, "Sotuvni yakunlashda xatolik yuz berdi"));
        setIsProcessing(false);
        return;
      }

      // Success!
      setCheckoutKey("");
      setShowCheckoutModal(false);
      setCompletedReceipt(data.data);
      setShowReceiptModal(true);
      setCart([]);
      setDiscountAmount(0);
      setPaidAmount(0);
      setSelectedCustomerId("");
      setLoyaltyPointsUsed(0);
      loadCustomers();
      loadProducts(); // Refresh stock
    } catch (err: any) {
      alert("Server bilan bog‘lanishda xatolik: " + (err.message || ""));
    } finally {
      setIsProcessing(false);
    }
  };

  // Qarzga sotish modalini ochish
  const handleOpenDebtSale = () => {
    if (!shiftOpen) { setStatusMessage({ text: "Qarzga sotishdan oldin smenani oching.", type: "error" }); return; }
    if (cart.length === 0) {
      alert("Savatcha bo‘sh!");
      return;
    }

    let prefill = { firstName: "", lastName: "", phone: "" };
    if (selectedCustomerId) {
      const customer = customers.find((c) => c.id === selectedCustomerId);
      if (customer) {
        const parts = String(customer.name || "").trim().split(/\s+/);
        prefill = {
          firstName: parts[0] || "",
          lastName: parts.slice(1).join(" ") || "",
          phone: customer.phone || "",
        };
      }
    }

    if (!debtKey) setDebtKey(crypto.randomUUID());
    setDebtForm(prefill);
    setDebtError(null);
    setShowDebtModal(true);
  };

  // Qarzga sotishni saqlash
  const handleCompleteDebtSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || isProcessingDebt) return;

    const firstName = debtForm.firstName.trim();
    const lastName = debtForm.lastName.trim();

    if (firstName.length < 2 || lastName.length < 2) {
      setDebtError("Ism va familiyani to‘liq kiriting (kamida 2 ta belgi).");
      return;
    }

    if (Number(discountAmount) > cartSubtotal) {
      setDebtError("Chegirma savat umumiy qiymatidan oshishi mumkin emas!");
      return;
    }

    setIsProcessingDebt(true);
    setDebtError(null);

    try {
      const payload = {
        customerId: selectedCustomerId || null,
        firstName,
        lastName,
        idempotencyKey: debtKey,
        expectedTotal: cartTotal,
        phone: debtForm.phone.trim() || null,
        discountAmount: Number(discountAmount) || 0,
        items: cart.map((item) => ({
          productId: item.productId,
          batchId: item.batchId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
        })),
      };

      const res = await fetch("/api/debts/sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setDebtError(getErrorMessage(data.error, "Qarzga sotishda xatolik yuz berdi"));
        return;
      }

      setDebtKey("");
      const savedAmount = Number(data.data?.amount ?? cartTotal);
      setShowDebtModal(false);
      setCompletedReceipt(data.data.receipt);
      setShowReceiptModal(true);
      setPaidAmount(0);
      setSelectedCustomerId("");
      setLoyaltyPointsUsed(0);
      setCart([]);
      loadCustomers();
      setDiscountAmount(0);
      setStatusMessage({
        text: `${firstName} ${lastName} nomiga ${formatCurrency(
          savedAmount
        )} qarz sifatida saqlandi. Qarzlar bo‘limiga o‘tdi.`,
        type: "success",
      });
      loadProducts();
    } catch (err: any) {
      setDebtError("Server bilan bog‘lanishda xatolik: " + (err.message || ""));
    } finally {
      setIsProcessingDebt(false);
    }
  };

  const categories = Array.from(new Map(products.filter(p => p.category).map(p => [p.category.id, p.category])).values());
  const filteredProducts = products.filter((m) => {
    if (categoryId && m.category?.id !== categoryId) return false;
    if (stockOnly && !(m.batches || []).some((b: any) => b.currentQuantity > 0 && new Date(b.expiryDate) > new Date())) return false;
    return (
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.barcode && m.barcode.includes(search)) ||
      (m.qrCode && m.qrCode.toLowerCase().includes(search.toLowerCase()))
    );
  });

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (event.key === "F2") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (event.key === "F4" && !showCheckoutModal && !showDebtModal && !showReceiptModal) {
        event.preventDefault();
        handleOpenCheckout();
      } else if (event.key === "Escape") {
        setShowCheckoutModal(false);
        setShowDebtModal(false);
        setShowPrecheck(false);
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  });

  return (
    <div className="pos-workspace space-y-4">
      <div className="pos-terminal-toolbar"><div className="pos-category-tabs" role="group" aria-label="Mahsulot kategoriyasi"><button type="button" className={!categoryId ? "selected" : ""} onClick={() => setCategoryId("")}>Barchasi</button>{categories.map((c: any) => <button type="button" key={c.id} className={categoryId === c.id ? "selected" : ""} onClick={() => setCategoryId(c.id)}>{c.name}</button>)}</div><label className="pos-stock-filter"><input type="checkbox" checked={stockOnly} onChange={e => setStockOnly(e.target.checked)}/> Omborda bor</label><button className="pos-stock-refresh" onClick={loadProducts} disabled={isLoading}><RotateCcw size={14} /> Yangilash</button></div>
      {/* USB Hardware Barcode Detector */}
      <UsbBarcodeDetector onScan={handleBarcodeScanned} enabled={!showCheckoutModal && !showPrecheck && !showReceiptModal && !showCameraScanner && !showDebtModal && !showCentralImportModal} />

      {/* Camera Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScanSuccess={handleBarcodeScanned}
        title="Kamera orqali mahsulotning shtrix-kodini skanerlang"
      />

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => {
          setShowReceiptModal(false);
          setCompletedReceipt(null);
          setSearch("");
          setStatusMessage(null);
          searchInputRef.current?.focus();
        }}
        receipt={completedReceipt}
      />

      {/* Status banner */}
      {statusMessage && (
        <div
          className={`rounded-xl p-3.5 text-xs font-bold flex items-center justify-between animate-in fade-in ${
            statusMessage.type === "success"
              ? "bg-primary-50 text-primary-800 border border-primary-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" ? (
              <CheckCircle className="h-4 w-4 text-primary-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)}>×</button>
        </div>
      )}

      {/* Terminal layout: active receipt, actions, and product lookup. */}
      <div className="pos-steps" aria-label="Savdo tartibi"><span className={shiftOpen ? "done" : "current"}>1. <Link href="/kassir/smena">{shiftOpen ? "Smena ochiq" : "Smenani oching"}</Link></span><span className={shiftOpen && !cart.length ? "current" : ""}>2. Mahsulot tanlang</span><span className={cart.length ? "current" : ""}>3. To‘lovni oling</span><span>4. <Link href="/kassir/smena">Smenani yoping</Link></span><Link href="/kassir/cheklar">Cheklar</Link><Link href="/kassir/qaytarish">Qaytarish</Link></div>
      <div className="terminal-layout">
        <section className="terminal-receipt">
          <div className="terminal-section-head"><div><span>FAOL CHEK</span><h2>Chek №{checkNumber} <small>· {cart.length} xil mahsulot</small></h2></div><button type="button" disabled={cart.length === 0} onClick={clearCart}><Trash2 size={15} /> Tozalash</button></div>
          <div className="terminal-table-scroll"><table className="terminal-table"><thead><tr><th>№</th><th>Mahsulot / kod</th><th>Narxi</th><th>Miqdor</th><th>Summa</th><th aria-label="O‘chirish" /></tr></thead><tbody>{cart.length ? cart.map((item, index) => <tr key={`${item.productId}-${index}`}><td>{index + 1}</td><td><strong>{item.productName}</strong><small>{item.batchNumber ? `#${item.batchNumber}` : ""}</small></td><td>{formatCurrency(item.unitPrice)}</td><td><div className="terminal-qty"><button type="button" onClick={() => item.quantity === 1 ? removeFromCart(index) : updateQuantity(index, item.quantity - 1)} aria-label="Kamaytirish"><Minus size={14} /></button><input type="number" min={1} max={item.availableQuantity} value={item.quantity} onChange={(event) => updateQuantity(index, Number(event.target.value))} aria-label={`${item.productName} miqdori`} /><button type="button" onClick={() => updateQuantity(index, item.quantity + 1)} aria-label="Ko‘paytirish"><Plus size={14} /></button></div></td><td><b>{formatCurrency(item.totalPrice)}</b></td><td><button type="button" className="terminal-row-remove" onClick={() => removeFromCart(index)} aria-label={`${item.productName} ni o‘chirish`}><X size={15} /></button></td></tr>) : <tr><td colSpan={6} className="terminal-empty"><ShoppingCart size={30} /><strong>Chek bo‘sh</strong><span>Mahsulotni tanlang yoki shtrix-kodni skanerlang.</span></td></tr>}</tbody></table></div>
          <div className="terminal-check-tabs"><span>Cheklar:</span><strong>№{checkNumber}</strong>{heldChecks.map((check) => <button key={check.number} type="button" onClick={() => restoreCheck(check.number)}>№{check.number} · {check.cart.length} ta</button>)}<button type="button" onClick={newCheck}><Plus size={13} /> Yangi chek</button></div>
          <div className="terminal-receipt-foot"><span>{cart.reduce((sum, item) => sum + item.quantity, 0)} ta mahsulot</span><strong>Jami: {formatCurrency(payableTotal)}</strong></div>
        </section>

        <aside className="terminal-actions" aria-label="Kassa amallari">
          <div className="terminal-action-head"><span className="pos-live-dot" /><strong>{shiftOpen ? "Kassa faol" : "Smena yopiq"}</strong><small>{shiftOpen ? "Yangi savdo" : "Smenani oching"}</small></div>
          <div className="terminal-action-buttons"><button type="button" onClick={newCheck}><RotateCcw size={17} /> Yangi chek</button><button type="button" disabled={cart.length === 0} onClick={() => setShowPrecheck(true)}><FileText size={17} /> Prechek</button><button type="button" onClick={() => setShowCameraScanner(true)}><Camera size={17} /> Skaner</button></div>
          <label className="terminal-field">Mijoz<select value={selectedCustomerId} onChange={event => { setSelectedCustomerId(event.target.value); setLoyaltyPointsUsed(0); }}><option value="">Oddiy xaridor</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}</select></label>
          {selectedCustomer && <label className="terminal-field">Bonus ballari <small>{availablePoints} ball mavjud · 1 ball = 1 000 so‘m</small><input type="number" min={0} max={maxRedeemablePoints} value={loyaltyPointsUsed} onChange={event => setLoyaltyPointsUsed(Math.min(maxRedeemablePoints, Math.max(0, Number(event.target.value) || 0)))} /></label>}
          <label className="terminal-field">Chegirma (so‘m)<input type="number" min={0} max={Math.max(0, cartSubtotal - 1)} step={500} value={discountAmount} onChange={event => setDiscountAmount(Math.min(Math.max(0, cartSubtotal - 1), Math.max(0, Number(event.target.value) || 0)))} /></label>
          <div className="terminal-totals"><div><span>Mahsulotlar</span><b>{formatCurrency(cartSubtotal)}</b></div>{discountAmount > 0 && <div><span>Chegirma</span><b>−{formatCurrency(discountAmount)}</b></div>}{loyaltyPointsUsed > 0 && <div><span>Ball chegirmasi</span><b>−{formatCurrency(loyaltyPointsUsed * 1000)}</b></div>}{taxSettings.taxRate > 0 && <div><span>QQS {taxSettings.taxRate}%</span><b>{formatCurrency(taxAmount)}</b></div>}</div>
          <div className="terminal-due"><span>TO‘LANADI</span><strong>{formatCurrency(payableTotal)}</strong></div>
          <button type="button" className="terminal-pay" disabled={!shiftOpen || cart.length === 0 || loyaltyPointsUsed > maxRedeemablePoints} onClick={handleOpenCheckout}><CheckCircle size={20} /> To‘lovni qabul qilish</button>
          <button type="button" className="terminal-debt" disabled={!shiftOpen || cart.length === 0} onClick={handleOpenDebtSale}><CreditCard size={17} /> Qarzga sotish</button>
        </aside>

        <section className="terminal-products"><div className="terminal-section-head"><div><span>MAHSULOTLAR</span><h2>Tezkor tanlash <small>· {filteredProducts.length} ta</small></h2></div><button type="button" onClick={loadProducts} disabled={isLoading}><RotateCcw size={15} /> Yangilash</button></div><div className="terminal-search"><Search size={19} /><input ref={searchInputRef} value={search} onChange={event => setSearch(event.target.value)} placeholder="Nomi, SKU yoki shtrix-kod bo‘yicha qidiring..." aria-label="Mahsulotni qidirish" /><button type="button" onClick={() => setShowCameraScanner(true)} title="Kamera skaner"><Camera size={18} /></button></div><div className="terminal-table-scroll"><table className="terminal-table terminal-catalog"><thead><tr><th>SKU / shtrix-kod</th><th>Mahsulot</th><th>Narxi</th><th>Qoldiq</th><th /></tr></thead><tbody>{isLoading ? <tr><td colSpan={5} className="terminal-loading">Mahsulotlar yuklanmoqda...</td></tr> : filteredProducts.length ? filteredProducts.map(product => <tr key={product.id}><td className="terminal-sku">{product.barcode || product.qrCode || "—"}</td><td><strong>{product.name}</strong><small>{product.category?.name || "Kategoriyasiz"}</small></td><td><b>{formatCurrency(product.salePrice)}</b></td><td><span className={product.totalStock > 0 ? "terminal-stock" : "terminal-no-stock"}>{product.totalStock > 0 ? `${product.totalStock} ${product.unit}` : "Tugagan"}</span></td><td><button type="button" className="terminal-add" disabled={product.totalStock <= 0} onClick={() => addToCart(product)}><Plus size={16} /> Qo‘shish</button></td></tr>) : <tr><td colSpan={5} className="terminal-loading">Mos mahsulot topilmadi.</td></tr>}</tbody></table></div></section>
      </div>

      {showPrecheck && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation"><div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-label="Oldindan chek"><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-bold text-blue-700">OLDINDAN CHEK</span><h2 className="mt-1 text-xl font-bold text-slate-900">Chek №{checkNumber}</h2><p className="mt-1 text-xs text-slate-500">To‘lov hali qabul qilinmagan.</p></div><button type="button" onClick={() => setShowPrecheck(false)} aria-label="Yopish"><X size={20} /></button></div><div className="mt-5 max-h-72 overflow-y-auto divide-y border-y">{cart.map((item, index) => <div key={index} className="flex justify-between gap-3 py-3 text-sm"><span>{item.productName} × {item.quantity}</span><b>{formatCurrency(item.totalPrice)}</b></div>)}</div><div className="mt-4 flex justify-between font-bold"><span>To‘lanadigan summa</span><span>{formatCurrency(payableTotal)}</span></div><button type="button" onClick={() => setShowPrecheck(false)} className="mt-6 w-full rounded-md bg-blue-700 px-4 py-3 font-bold text-white">Kassaga qaytish</button></div></div>}

      {/* CHECKOUT PAYMENT MODAL (Section 21) */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
              <h3 className="text-base font-extrabold text-slate-900">To‘lovni Qabul Qilish</h3>
              <p className="text-xs text-slate-500 mt-0.5">To‘lov turini tanlang va summani kiriting</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Payment Methods (Naqd, Karta, Elektron) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  To‘lov Turi
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CASH")}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-bold transition-all ${
                      paymentMethod === "CASH"
                        ? "border-[#1e50b3] bg-primary-50 text-primary-800 ring-2 ring-primary-500/20"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Banknote className="h-5 w-5 text-primary-600" />
                    <span>Naqd pul</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CARD")}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-bold transition-all ${
                      paymentMethod === "CARD"
                        ? "border-[#1e50b3] bg-primary-50 text-primary-800 ring-2 ring-primary-500/20"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <CreditCard className="h-5 w-5 text-primary-600" />
                    <span>Bank kartasi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("ELECTRONIC")}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-bold transition-all ${
                      paymentMethod === "ELECTRONIC"
                        ? "border-[#1e50b3] bg-primary-50 text-primary-800 ring-2 ring-primary-500/20"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Smartphone className="h-5 w-5 text-primary-600" />
                    <span>Elektron to‘lov</span>
                  </button>
                </div>
              </div>

              {/* Total and Paid Amount inputs */}
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-2">
                {taxSettings.taxRate > 0 && (
                  <div className="flex justify-between items-center text-xs text-slate-600">
                    <span>
                      QQS ({taxSettings.taxRate}%{taxSettings.taxIncluded ? ", ichida" : ""}):
                    </span>
                    <span className="font-bold">{formatCurrency(taxAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium">To‘lanadigan summa:</span>
                  <span className="text-base font-extrabold text-primary-700">
                    {formatCurrency(payableTotal)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mt-2">
                    Qabul qilingan summa (so‘m):
                  </label>
                  <input
                    type="number"
                    min={payableTotal}
                    step="1000"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base font-extrabold text-slate-900 focus:border-[#1e50b3] focus:outline-none"
                  />
                </div>

                {paidAmount > payableTotal && (
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-xs">
                    <span className="font-bold text-slate-700">Xaridorga qaytim:</span>
                    <span className="font-extrabold text-blue-700 text-sm">
                      {formatCurrency(paidAmount - payableTotal)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Bekor qilish
              </button>

              <button
                type="button"
                disabled={isProcessing || paidAmount < payableTotal || loyaltyPointsUsed > maxRedeemablePoints}
                onClick={handleCompleteSale}
                className="flex items-center gap-2 rounded-xl bg-[#1e50b3] px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#123d99] disabled:opacity-50"
              >
                {isProcessing ? (
                  <span>Saqlanmoqda...</span>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>Sotuvni Yakunlash va Chek Chiqarish</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QARZGA SOTISH MODALI */}
      {showDebtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 bg-amber-50 px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Qarzga Sotish</h3>
                  <p className="text-[11px] text-slate-500">
                    Mahsulot qarzlar bo‘limiga yoziladi, to‘lov keyinroq qabul qilinadi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDebtModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCompleteDebtSale} className="p-6 space-y-4">
              {debtError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{debtError}</span>
                </div>
              )}

              {/* Savatdagi mahsulotlar */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Sotilayotgan mahsulotlar ({cart.length})
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-700 truncate">
                        {item.quantity} × {item.productName}
                      </span>
                      <span className="font-bold text-slate-900 shrink-0">
                        {formatCurrency(item.totalPrice)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-sm">
                  <span className="font-bold text-slate-700">Qarz summasi:</span>
                  <span className="font-extrabold text-amber-700">{formatCurrency(cartTotal)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Mijoz ismi *</label>
                  <input
                    type="text"
                    required
                    value={debtForm.firstName}
                    onChange={(e) => setDebtForm({ ...debtForm, firstName: e.target.value })}
                    placeholder="Masalan: Sardor"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs md:text-sm text-slate-800 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">Mijoz familiyasi *</label>
                  <input
                    type="text"
                    required
                    value={debtForm.lastName}
                    onChange={(e) => setDebtForm({ ...debtForm, lastName: e.target.value })}
                    placeholder="Masalan: Rahimov"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs md:text-sm text-slate-800 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Telefon raqami</label>
                <input
                  type="text"
                  value={debtForm.phone}
                  onChange={(e) => setDebtForm({ ...debtForm, phone: e.target.value })}
                  placeholder="+998 90 123 45 67"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs md:text-sm text-slate-800 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDebtModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isProcessingDebt}
                  className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-amber-600 disabled:opacity-50"
                >
                  {isProcessingDebt ? (
                    <span>Saqlanmoqda...</span>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      <span>Qarzga Sotishni Tasdiqlash</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Central Product Code Center Import Modal */}
      <CentralProductModal
        isOpen={showCentralImportModal}
        onClose={() => setShowCentralImportModal(false)}
        centralProduct={centralProductToImport}
        onImportSuccess={handleCentralImportSuccess}
      />
    </div>
  );
}
