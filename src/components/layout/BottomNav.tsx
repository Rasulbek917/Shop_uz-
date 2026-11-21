"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  BadgePercent,
  Receipt,
  Boxes,
  Package,
  BarChart3,
  CreditCard,
} from "lucide-react";
import { AuthUser } from "@/types";

export default function BottomNav({ user }: { user: AuthUser }) {
  const pathname = usePathname();

  let items: Array<{ label: string; href: string; icon: React.ComponentType<{ className?: string }> }> = [];

  if (user.role === "CASHIER") {
    items = [
      { label: "Savdo (POS)", href: "/kassir", icon: BadgePercent },
      { label: "Savdo tarixi", href: "/kassir/cheklar", icon: Receipt },
    ];
  } else if (user.role === "WAREHOUSEMAN") {
    items = [
      { label: "Bosh sahifa", href: "/omborchi", icon: LayoutDashboard },
      { label: "Ombor", href: "/omborchi/ombor", icon: Boxes },
    ];
  } else if (user.role === "SUPER_ADMIN") {
    items = [
      { label: "Boshqaruv", href: "/super-admin", icon: LayoutDashboard },
      { label: "Do‘konlar", href: "/super-admin/dokonlar", icon: Building2 },
    ];
  } else {
    items = [
      { label: "Bosh sahifa", href: "/admin", icon: LayoutDashboard },
      { label: "Kassa", href: "/admin/pos", icon: BadgePercent },
      { label: "Tovarlar", href: "/admin/tovarlar", icon: Package },
      { label: "Hisobotlar", href: "/admin/hisobotlar", icon: BarChart3 },
      { label: "Moliya", href: "/admin/moliya", icon: CreditCard },
    ];
  }

  if (user.role === "SHOP_ADMIN") {
    items = items.filter((item) =>
      (item.href !== "/admin/tovarlar" || user.menuVisibility?.products !== false) &&
      (item.href !== "/admin/hisobotlar" || user.menuVisibility?.reports !== false) &&
      (item.href !== "/admin/moliya" || user.menuVisibility?.finance !== false)
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-16 border-t border-slate-200 bg-white shadow-lg md:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href ||
          (item.href === "/kassir/cheklar" && pathname === "/kassir/tarixim");

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${
              isActive ? "text-[#24634F] font-bold" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[11px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
