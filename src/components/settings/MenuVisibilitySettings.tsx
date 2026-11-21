"use client";

import { useState } from "react";
import { optionalMenuItems, type MenuVisibility } from "@/lib/menu-visibility";

export default function MenuVisibilitySettings({ initial }: { initial: MenuVisibility }) {
  const [visibility, setVisibility] = useState<MenuVisibility>(initial);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function toggle(key: (typeof optionalMenuItems)[number]["key"]) {
    const enabled = visibility[key] !== false;
    setSaving(key);
    setError("");
    try {
      const response = await fetch("/api/shop/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuVisibility: { [key]: !enabled } }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || "Sozlamani saqlab bo‘lmadi");
      }
      const updated = result.data.menuVisibility as MenuVisibility;
      setVisibility(updated);
      window.dispatchEvent(new CustomEvent("menu-visibility-changed", { detail: updated }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sozlamani saqlab bo‘lmadi");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-bold text-slate-900">Menyudagi bo‘limlar</h2>
      <p className="mt-2 text-sm text-slate-600">O‘chirilgan bo‘lim menyudan yo‘qoladi. Istalgan payt qayta yoqishingiz mumkin.</p>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {optionalMenuItems.map(({ key, label }) => (
          <label key={key} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 text-sm font-medium text-slate-800">
            <span>{label}</span>
            <input
              type="checkbox"
              className="h-5 w-5 accent-emerald-700"
              checked={visibility[key] !== false}
              disabled={saving !== null}
              onChange={() => toggle(key)}
              aria-label={`${label} bo‘limini menyuda ko‘rsatish`}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
