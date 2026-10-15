"use client";

import React, { useState, useEffect } from "react";
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
  const [currentUser, setCurrentUser] = useState<AuthUser>(user);

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
    const interval = setInterval(refresh, 10 * 60 * 1000);

    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user.role]);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <Sidebar
        user={currentUser}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col pb-20 md:pb-8 min-w-0 overflow-hidden">
        <Navbar
          user={currentUser}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />

        {/* Dynamic warning banner if trial or subscription is expiring */}
        <TrialWarningBanner user={currentUser} />

        <main className="flex-1 px-4 py-5 md:px-6 md:py-6">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <BottomNav user={currentUser} />
      </div>
    </div>
  );
}
