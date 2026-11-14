"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { DemoPlayer } from "@/components/marketing/Experience";
import { getErrorMessage } from "@/lib/errorMessage";

export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: String(form.get("username")).trim(), password: form.get("password") }),
      });
      const data = await response.json().catch(() => null);
      if (!data) throw new Error("Server javobi olinmadi. Qayta urinib ko‘ring.");
      if (!response.ok || !data.success) throw new Error(getErrorMessage(data.error));
      const user = data.user;
      router.push(user.role === "SUPER_ADMIN" ? "/super-admin" : !user.hasAccess ? "/account" : user.role === "SHOP_ADMIN" ? "/admin" : user.role === "CASHIER" ? "/kassir" : "/omborchi");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Internet aloqasini tekshirib, qayta urinib ko‘ring.");
      setBusy(false);
    }
  }

  return <div className="marketing auth-screen login-screen">
    <aside className="auth-story login-showcase">
      <Link href="/" className="wordmark">savdoza®</Link>
      <div className="login-showcase-copy">
        <h1>Do‘koningiz.<br/>Bir joyda.</h1>
        <p>Savdoza bilan yaqindan tanishing.</p>
      </div>
      <DemoPlayer/>
      <span><ShieldCheck size={17}/> Shaxsiy hisob orqali xavfsiz kirish</span>
    </aside>
    <main className="auth-form-area">
      <Link href="/" className="auth-back">← Bosh sahifa</Link>
      <span className="eyebrow">XUSH KELIBSIZ</span>
      <h1>Hisobingizga kiring</h1>
      <p>Yangi foydalanuvchimisiz? <Link href="/register">Ro‘yxatdan o‘tish</Link></p>
      <form onSubmit={submit} className="public-form">
        <label>Login<input name="username" autoComplete="username" placeholder="Loginingiz" required maxLength={50}/></label>
        <label>Parol
          <div className="login-password">
            <input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Parolingiz" required maxLength={72}/>
            <button type="button" aria-label={showPassword ? "Parolni yashirish" : "Parolni ko‘rsatish"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button>
          </div>
        </label>
        {error && <p role="alert" className="form-error">{error}</p>}
        <button disabled={busy} className="public-button large">{busy ? "Kirilmoqda…" : "Kirish"}<ArrowUpRight size={18}/></button>
        <small>Hisobingizda tarif va arizangiz holatini ko‘rishingiz mumkin.</small>
      </form>
    </main>
  </div>;
}
