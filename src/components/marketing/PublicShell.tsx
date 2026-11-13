"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Layers3 } from "lucide-react";
export function PublicHeader({ username, plan }: { username?: string; plan?: string } = {}) {
  const [session, setSession] = useState<{ username: string; planCode?: string | null } | null>();
  useEffect(() => {
    if (username) return;
    let active = true;
    let running = false;
    async function refresh() {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" });
        if (response.status === 401) {
          if (active) setSession(null);
          return;
        }
        const result = await response.json();
        if (active && response.ok && result.success && result.user) setSession(result.user);
      } catch {
        // Keep the last confirmed account during temporary connection failures.
      } finally { running = false; }
    }
    void refresh();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [username]);
  const currentUsername = username || session?.username;
  const currentPlan = plan || session?.planCode;
  return <header className="public-header"><Link href="/" className="wordmark"><Layers3 size={27} /> savdoza<span>®</span></Link><nav aria-label="Asosiy menyu"><Link href="/#imkoniyatlar">Imkoniyatlar</Link><Link href="/#demo">Qanday ishlaydi</Link><Link href="/#tariflar">Tariflar</Link><Link href="/download">Yuklab olish</Link></nav><div className="header-actions">{currentUsername ? <><span className="text-xs">Login <b>{currentUsername}</b></span><Link href="/account">Hisobim</Link><Link className="public-button" href="/account">{currentPlan === "PRO" ? "Pro tarifi" : currentPlan === "MAX" ? "Max tarifi" : "Mening tarifim"}</Link></> : session === undefined ? <Link href="/account">Hisobim</Link> : <><Link href="/login">Kirish</Link><Link className="public-button" href="/register">Boshlash <ArrowUpRight size={16}/></Link></>}</div></header>;
}
export function PublicFooter() {
  return <footer className="public-footer"><div><Link className="wordmark" href="/">savdoza®</Link><p>Savdo aniq. Boshqaruv oson.</p><small>Do‘koningizning kundalik ishlari bir joyda.</small></div><div><b>Mahsulot</b><Link href="/#imkoniyatlar">Imkoniyatlar</Link><Link href="/#tariflar">Pro va Max</Link><Link href="/#demo">Video namoyish</Link><Link href="/download">Android va Windows</Link></div><div><b>Hisob</b><Link href="/register">Ro‘yxatdan o‘tish</Link><Link href="/login">Tizimga kirish</Link><Link href="/account">Mening tarifim</Link></div><div><b>Ishonch va xavfsizlik</b><Link href="/security">Xavfsizlik</Link><Link href="/privacy">Maxfiylik</Link><Link href="/terms">Foydalanish shartlari</Link></div><div className="footer-bottom">© {new Date().getFullYear()} Savdoza <span>O‘zbek tilida. Do‘konlar uchun.</span></div></footer>;
}
