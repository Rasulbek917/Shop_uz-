"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  Package,
  Printer,
  ScanLine,
  Settings,
  QrCode,
} from "lucide-react";

export default function BarcodeNav() {
  const pathname = usePathname();

  const links = [
    { name: "Asosiy panel", href: "/admin/shtrix-kodlar", icon: LayoutDashboard },
    { name: "Shtrix-kod yaratish", href: "/admin/shtrix-kodlar/yaratish", icon: PlusCircle },
    { name: "Kodlar ro'yxati", href: "/admin/shtrix-kodlar/mahsulotlar", icon: Package },
    { name: "Etiketka chop etish", href: "/admin/shtrix-kodlar/chop-etish", icon: Printer },
    { name: "Skaner & Qidiruv", href: "/admin/shtrix-kodlar/skaner", icon: ScanLine },
    { name: "Sozlamalar", href: "/admin/shtrix-kodlar/sozlamalar", icon: Settings },
  ];

  return (
    <div className="no-print bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5 mb-6 overflow-x-auto">
      <div className="flex items-center gap-1 min-w-max">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? "bg-[#16A34A] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{link.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
