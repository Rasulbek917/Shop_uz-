"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  Save,
  RefreshCw,
  KeyRound,
  User as UserIcon,
  Phone,
  AtSign,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { getErrorMessage } from "@/lib/errorMessage";
import { getRoleLabel } from "@/lib/formatters";

interface Profile {
  id: string;
  username: string;
  fullName: string;
  phone: string | null;
  role: string;
  shopName: string | null;
}

export default function SettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("");
  const [shopName, setShopName] = useState<string | null>(null);

  // Profil formasi
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Parol formasi
  const [pwdForm, setPwdForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const splitName = (fullName: string) => {
    const parts = (fullName || "").trim().split(/\s+/);
    if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  };

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      const data = await res.json();
      if (data.success && data.data) {
        const p: Profile = data.data;
        const { firstName: fn, lastName: ln } = splitName(p.fullName);
        setFirstName(fn);
        setLastName(ln);
        setPhone(p.phone || "");
        setUsername(p.username || "");
        setRole(p.role || "");
        setShopName(p.shopName || null);
      } else {
        setProfileMsg({ text: getErrorMessage(data.error, "Profilni yuklab bo‘lmadi"), type: "error" });
      }
    } catch {
      setProfileMsg({ text: "Server bilan bog‘lanishda xatolik yuz berdi", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (fullName.length < 2) {
      setProfileMsg({ text: "Ism va familiyani kiriting", type: "error" });
      return;
    }
    if (username.trim().length < 3) {
      setProfileMsg({ text: "Login kamida 3 ta belgidan iborat bo‘lishi kerak", type: "error" });
      return;
    }
    if (/\s/.test(username.trim())) {
      setProfileMsg({ text: "Login bo‘sh joy (probel) bo‘lmasligi kerak", type: "error" });
      return;
    }

    setSavingProfile(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phone, username: username.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setProfileMsg({ text: getErrorMessage(data.error, "Saqlashda xatolik yuz berdi"), type: "error" });
        return;
      }
      setProfileMsg({ text: data.message || "Profil saqlandi", type: "success" });
      if (data.data) {
        setUsername(data.data.username);
        setPhone(data.data.phone || "");
      }
      // Navbar va boshqa joylardagi ism yangilanishi uchun
      router.refresh();
    } catch {
      setProfileMsg({ text: "Server bilan bog‘lanishda xatolik yuz berdi", type: "error" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);

    if (!pwdForm.currentPassword || !pwdForm.newPassword || !pwdForm.confirmPassword) {
      setPwdMsg({ text: "Barcha maydonlarni to‘ldiring", type: "error" });
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdMsg({ text: "Yangi parol va tasdiqlash paroli mos kelmadi", type: "error" });
      return;
    }

    setSavingPwd(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pwdForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPwdMsg({ text: getErrorMessage(data.error, "Parolni almashtirishda xatolik yuz berdi"), type: "error" });
        return;
      }
      setPwdMsg({ text: data.message || "Parol muvaffaqiyatli almashtirildi", type: "success" });
      setPwdForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch {
      setPwdMsg({ text: "Server bilan bog‘lanishda xatolik yuz berdi", type: "error" });
    } finally {
      setSavingPwd(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
          <Settings className="h-5 w-5 text-emerald-700" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Sozlamalar</h2>
          <p className="text-xs text-slate-500">
            {getRoleLabel(role)}
            {shopName ? ` • ${shopName}` : ""}
          </p>
        </div>
      </div>

      {/* Profil ma'lumotlari */}
      <form
        onSubmit={handleSaveProfile}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
      >
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <UserIcon className="h-4 w-4 text-emerald-600" />
          Profil ma‘lumotlari
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Ism</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ism"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Familiya</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Familiya"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1">
            <Phone className="h-3.5 w-3.5" /> Telefon raqam
          </label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+998 90 123 45 67"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1">
            <AtSign className="h-3.5 w-3.5" /> Login
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="login"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Login tizimga kirishda ishlatiladi. Boshqa foydalanuvchi egallagan login bo‘lmasligi kerak.
          </p>
        </div>

        {profileMsg && (
          <div
            className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-medium ${
              profileMsg.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {profileMsg.type === "success" ? (
              <CheckCircle className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{profileMsg.text}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={savingProfile}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#16A34A] py-3 text-sm font-extrabold text-white shadow-md shadow-emerald-600/20 hover:bg-[#15803D] disabled:opacity-50"
        >
          {savingProfile ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{savingProfile ? "Saqlanmoqda..." : "Profilni saqlash"}</span>
        </button>
      </form>

      {/* Parolni almashtirish */}
      <form
        onSubmit={handleChangePassword}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
      >
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <KeyRound className="h-4 w-4 text-emerald-600" />
          Parolni almashtirish
        </h3>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Joriy parol</label>
          <input
            type="password"
            value={pwdForm.currentPassword}
            onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
            autoComplete="current-password"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Yangi parol</label>
            <input
              type="password"
              value={pwdForm.newPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
              autoComplete="new-password"
              minLength={5}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Yangi parolni tasdiqlash</label>
            <input
              type="password"
              value={pwdForm.confirmPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
              autoComplete="new-password"
              minLength={5}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {pwdMsg && (
          <div
            className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-medium ${
              pwdMsg.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {pwdMsg.type === "success" ? (
              <CheckCircle className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{pwdMsg.text}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={savingPwd}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {savingPwd ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          <span>{savingPwd ? "Almashtirilmoqda..." : "Parolni almashtirish"}</span>
        </button>
      </form>
    </div>
  );
}
