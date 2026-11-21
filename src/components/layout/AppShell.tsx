"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { CircleHelp } from "lucide-react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import TrialWarningBanner from "../common/TrialWarningBanner";
import { AuthUser } from "@/types";

export default function AppShell({
  user,
  children,
}: {
  user: AuthUser;
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPosMenuExpanded, setIsPosMenuExpanded] = useState(false);
  const [language, setLanguage] = useState<"uz" | "en">("uz");
  const [currentUser, setCurrentUser] = useState<AuthUser>(user);
  const pathname = usePathname();
  const isPosPage = pathname === "/admin/pos" || pathname === "/kassir";
  const helpLesson = pathname.includes("mahsulot") || pathname.includes("tovar") || pathname.includes("kategoriya") ? "products"
    : pathname.includes("ombor") || pathname.includes("partiya") ? "inventory"
    : isPosPage || pathname.includes("qaytarish") || pathname.includes("chek") ? "pos"
    : pathname.includes("qarz") || pathname.includes("mijoz") || pathname.includes("moliya") ? "debts"
    : pathname.includes("hisobot") || pathname.includes("smena") ? "reports"
    : pathname.includes("xodim") ? "staff" : "setup";

  useEffect(() => {
    setIsPosMenuExpanded(false);
  }, [pathname]);

  useEffect(() => {
    if (localStorage.getItem("savdoza-language") === "en") setLanguage("en");
    const onLanguage = (event: Event) => setLanguage((event as CustomEvent<"uz" | "en">).detail);
    window.addEventListener("savdoza-language-changed", onLanguage);
    return () => window.removeEventListener("savdoza-language-changed", onLanguage);
  }, []);

  useEffect(() => {
    const updateMenu = (event: Event) => {
      setCurrentUser((current) => ({
        ...current,
        menuVisibility: (event as CustomEvent<Record<string, boolean>>).detail,
      }));
    };
    window.addEventListener("menu-visibility-changed", updateMenu);
    return () => window.removeEventListener("menu-visibility-changed", updateMenu);
  }, []);

  // Serverdan kelgan user ma'lumotini doim sinxronlab turamiz
  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  // MUHIM: Sinov (trial) va obuna kunlari JWT token ichida login paytida
  // hisoblanadi. Shu sababli vaqt o'tishi bilan ular eskirib qoladi
  // (masalan, tepada 7 kun, lekin aslida 5 kun qolgan bo'ladi).
  // Tepada har doim to'g'ri qiymat ko'rinishi uchun bazadan yangilab turamiz.
  useEffect(() => {
    if (user.role === "SUPER_ADMIN") return;

    let active = true;

    const refresh = async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (active && data?.success && data.user) {
          if (!data.user.hasAccess) { window.location.replace("/account"); return; }
          setCurrentUser((prev) => ({ ...prev, ...data.user }));
        }
      } catch {
        // Tarmoq xatosi bo'lsa eski qiymat qoladi
      }
    };

    refresh();

    // Tab qayta faollashganda ham yangilaymiz
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Har 10 daqiqada avtomatik yangilash
    const interval = setInterval(refresh, 60 * 1000);

    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user.role]);

  return (
    <div className="admin-shell flex min-h-screen bg-[#f8fafc]">
      {/* Sidebar */}
      <Sidebar
        user={currentUser}
        language={language}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        compact={isPosPage && !isPosMenuExpanded}
        onToggleCompact={isPosPage ? () => setIsPosMenuExpanded((expanded) => !expanded) : undefined}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col pb-20 md:pb-8 min-w-0 overflow-hidden">
        <Navbar
          user={currentUser}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />

        {/* Dynamic warning banner if trial or subscription is expiring */}
        <TrialWarningBanner user={currentUser} />

        <main className="min-w-0 flex-1 px-3 py-4 md:px-4 md:py-4">
          {pathname !== "/qollanma" && <div className="mb-3 flex justify-end"><Link href={`/qollanma?lesson=${helpLesson}`} className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-700"><CircleHelp size={14} />{language === "uz" ? "Qanday ishlaydi?" : "How does it work?"}</Link></div>}
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <BottomNav user={currentUser} />
      </div>
    </div>
  );
}
