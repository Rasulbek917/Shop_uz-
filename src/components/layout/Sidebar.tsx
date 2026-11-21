"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  ScrollText,
  Package,
  Boxes,
  ShoppingCart,
  RotateCcw,
  Users,
  Truck,
  UserCog,
  BarChart3,
  CalendarClock,
  BadgePercent,
  Receipt,
  X,
  ShieldCheck,
  Settings,
  CircleHelp,
  QrCode,
  LockKeyhole,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { AuthUser, UserRole } from "@/types";
import { isMax } from "@/lib/plans";
import { optionalMenuItems } from "@/lib/menu-visibility";

interface SidebarProps {
  user: AuthUser;
  language: "uz" | "en";
  isOpen: boolean;
  onClose: () => void;
  compact: boolean;
  onToggleCompact?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresMax?: boolean;
}

const englishLabels: Record<string, string> = {
  "/admin": "Dashboard", "/admin/pos": "Checkout", "/admin/smena": "Shifts", "/admin/hisobotlar": "Reports", "/admin/tovarlar": "Products", "/admin/ombor": "Inventory", "/admin/moliya": "Finance", "/admin/xodimlar": "Staff", "/admin/mijozlar": "Customers", "/sozlamalar": "Settings", "/qollanma": "Video guide", "/kassir": "POS terminal", "/kassir/smena": "Shifts", "/kassir/cheklar": "Sales history", "/kassir/qaytarish": "Returns", "/omborchi": "Dashboard", "/omborchi/ombor": "Inventory", "/omborchi/partiyalar": "Batches", "/omborchi/mahsulotlar": "Add product", "/super-admin": "Dashboard", "/super-admin/xabarlar": "Messages", "/super-admin/tariflar": "Plans", "/super-admin/dokonlar": "Stores", "/admin/shtrix-kodlar": "Barcodes", "/super-admin/obunalar": "Subscriptions", "/super-admin/audit-log": "Audit log",
};

export default function Sidebar({ user, language, isOpen, onClose, compact, onToggleCompact }: SidebarProps) {
  const pathname = usePathname();

  const getNavItems = (role: UserRole): NavItem[] => {
    switch (role) {
      case "SUPER_ADMIN":
        return [
          { label: "Boshqaruv paneli", href: "/super-admin", icon: LayoutDashboard },
          { label: "Xabarlar va arizalar", href: "/super-admin/xabarlar", icon: ScrollText },
          { label: "Tarif sozlamalari", href: "/super-admin/tariflar", icon: CreditCard },
          { label: "Do‘konlar", href: "/super-admin/dokonlar", icon: Building2 },
          { label: "QR / Shtrix-kodlar", href: "/admin/shtrix-kodlar", icon: QrCode },
          { label: "Obuna va Sinov", href: "/super-admin/obunalar", icon: CreditCard },
          { label: "Tizim jurnali (Audit)", href: "/super-admin/audit-log", icon: ScrollText },
          { label: "Sozlamalar", href: "/sozlamalar", icon: Settings },
          { label: "Video qo‘llanma", href: "/qollanma", icon: CircleHelp },
        ];

      case "SHOP_ADMIN":
        return [
          { label: "Bosh sahifa", href: "/admin", icon: LayoutDashboard },
          { label: "Kassa", href: "/admin/pos", icon: BadgePercent },
          { label: "Smena", href: "/admin/smena", icon: CalendarClock },
          { label: "Hisobotlar", href: "/admin/hisobotlar", icon: BarChart3 },
          { label: "Tovarlar", href: "/admin/tovarlar", icon: Package },
          { label: "Ombor", href: "/admin/ombor", icon: Boxes },
          { label: "Moliya", href: "/admin/moliya", icon: CreditCard },
          { label: "Xodimlar", href: "/admin/xodimlar", icon: UserCog, requiresMax: true },
          { label: "Mijozlar", href: "/admin/mijozlar", icon: Users },
          { label: "Sozlamalar", href: "/sozlamalar", icon: Settings },
          { label: "Video qo‘llanma", href: "/qollanma", icon: CircleHelp },
        ];

      case "WAREHOUSEMAN":
        return [
          { label: "Bosh sahifa", href: "/omborchi", icon: LayoutDashboard },
          { label: "Ombor", href: "/omborchi/ombor", icon: Boxes },
          { label: "Partiyalar va muddat", href: "/omborchi/partiyalar", icon: CalendarClock },
          { label: "Mahsulot qo‘shish", href: "/omborchi/mahsulotlar", icon: Package },
          { label: "Sozlamalar", href: "/sozlamalar", icon: Settings },
          { label: "Video qo‘llanma", href: "/qollanma", icon: CircleHelp },
        ];

      case "CASHIER":
        return [
          { label: "POS Savdo terminali", href: "/kassir", icon: BadgePercent },
          { label: "Smena", href: "/kassir/smena", icon: CalendarClock },
          { label: "Savdo tarixi", href: "/kassir/cheklar", icon: Receipt },
          { label: "Tovarni qaytarish", href: "/kassir/qaytarish", icon: RotateCcw },
          { label: "Sozlamalar", href: "/sozlamalar", icon: Settings },
          { label: "Video qo‘llanma", href: "/qollanma", icon: CircleHelp },
        ];

      default:
        return [];
    }
  };

  const navItems = getNavItems(user.role).filter((item) => {
    if (user.role !== "SHOP_ADMIN") return true;
    const optional = optionalMenuItems.find(({ href }) => href === item.href);
    return !optional || user.menuVisibility?.[optional.key] !== false;
  });

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col bg-[#08358d] text-white transition-[transform,width] duration-300 ease-in-out md:static md:translate-x-0 ${compact ? "md:w-[72px]" : "md:w-64"} ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand header */}
        <div className={`flex h-16 items-center justify-between border-b border-slate-800 px-6 ${compact ? "md:px-3" : ""}`}>
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 text-white shadow-md">
              <Package className="h-5 w-5" />
            </div>
            <div className={compact ? "md:hidden" : ""}>
              <span className="font-extrabold text-base tracking-wide text-white">
                SAVDO<span className="text-[#c7ddff]">ZA</span>
              </span>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                {language === "uz" ? "Boshqaruv Tizimi" : "Management System"}
              </p>
            </div>
          </Link>

          {onToggleCompact && <button type="button" onClick={onToggleCompact} className="hidden rounded-lg p-1.5 text-blue-100 hover:bg-white/10 md:flex" title={compact ? "Menyuni kengaytirish" : "Menyuni kichraytirish"} aria-label={compact ? "Menyuni kengaytirish" : "Menyuni kichraytirish"}>
            {compact ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>}

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className={`flex-1 overflow-y-auto px-4 py-4 space-y-1 ${compact ? "md:px-2" : ""}`}>
          <div className={`px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 ${compact ? "md:hidden" : ""}`}>
            {language === "uz" ? "Asosiy menyu" : "Main menu"}
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const label = language === "en" ? englishLabels[item.href] || item.label : item.label;
            const isActive =
              pathname === item.href ||
              (item.href === "/admin/hisobotlar" && ["/admin/sotuv-hisoboti", "/admin/sotuvlar", "/admin/cheklar", "/admin/smena", "/admin/qaytarishlar"].some((path) => pathname.startsWith(path))) ||
              (item.href === "/admin/tovarlar" && ["/admin/mahsulotlar", "/admin/kategoriyalar", "/admin/shtrix-kodlar", "/admin/partiyalar"].some((path) => pathname.startsWith(path))) ||
              (item.href === "/admin/moliya" && ["/admin/qarzlar", "/admin/yetkazib-beruvchilar"].some((path) => pathname.startsWith(path))) ||
              (item.href === "/admin/mahsulotlar" &&
                (pathname === "/admin/kategoriyalar" ||
                  pathname === "/admin/shtrix-kodlar" ||
                  pathname.startsWith("/admin/shtrix-kodlar/"))) ||
              (item.href === "/kassir/cheklar" && pathname === "/kassir/tarixim");

            if (item.requiresMax && !isMax(user.planCode)) {
              return <button key={item.href} type="button" disabled title="Premium tarifiga o‘ting"
                className={`flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-400 ${compact ? "md:justify-center md:px-2" : ""}`}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className={`flex-1 ${compact ? "md:hidden" : ""}`}>{label}<small className="block text-[10px] text-amber-200/80">{language === "uz" ? "Premium tarifiga o‘ting" : "Upgrade to Premium"}</small></span>
                <LockKeyhole className={`h-3.5 w-3.5 shrink-0 ${compact ? "md:hidden" : ""}`} />
              </button>;
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onClose()}
                aria-label={label}
                title={compact ? label : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${compact ? "md:justify-center md:px-2" : ""} ${
                  isActive
                    ? "bg-white text-[#08358d] shadow-sm"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-[#08358d]" : "text-blue-100"}`} />
                <span className={compact ? "md:hidden" : ""}>{label}</span>
              </Link>
            );
          })}
          {user.role === "SHOP_ADMIN" && !isMax(user.planCode) && (
            <Link href="/sozlamalar/tarif?plan=MAX" onClick={onClose} className={`mt-4 block rounded-xl border border-amber-200/30 px-3 py-3 text-sm font-semibold text-amber-100 hover:bg-white/5 ${compact ? "md:hidden" : ""}`}>
              {language === "uz" ? "Premium tarifiga o‘tish" : "Upgrade to Premium"}
            </Link>
          )}
        </div>

        {/* Security badge at bottom */}
        <div className={`border-t border-slate-800 p-4 ${compact ? "md:px-2" : ""}`}>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-[#b9d2ff]" />
            <span className={compact ? "md:hidden" : ""}>{language === "uz" ? "Savdo va ombor bir joyda" : "Sales and inventory together"}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
