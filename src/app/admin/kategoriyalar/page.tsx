"use client";
import { useEffect, useState } from "react";
import { clientApi, jsonOptions } from "@/lib/client-api";

type Category = {
  id: string;
  name: string;
  description: string | null;
  _count: { products: number };
};
export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    try {
      setCategories(await clientApi("/api/categories"));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  function reset() {
    setEditing(null);
    setName("");
    setDescription("");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await clientApi(
        editing ? `/api/categories/${editing}` : "/api/categories",
        jsonOptions(editing ? "PATCH" : "POST", {
          name: name.trim(),
          description: description.trim() || null,
        }),
      );
      reset();
      await load();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(category: Category) {
    if (!window.confirm(`“${category.name}” kategoriyasini o‘chirasizmi?`))
      return;
    setBusy(true);
    setError("");
    try {
      await clientApi(`/api/categories/${category.id}`, { method: "DELETE" });
      await load();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Kategoriyalar</h1>
        <p>Mahsulotlarni guruhlang va katalogdan tezroq toping.</p>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
          {error}
        </p>
      )}
      <form
        onSubmit={save}
        className="grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-2"
      >
        <label className="text-sm">
          Kategoriya nomi
          <input
            className="input-field mt-1"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
          />
        </label>
        <label className="text-sm">
          Izoh
          <input
            className="input-field mt-1"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <div className="flex gap-3">
          <button className="btn-primary" disabled={busy}>
            {busy
              ? "Saqlanmoqda…"
              : editing
                ? "Saqlash"
                : "Kategoriya qo‘shish"}
          </button>
          {editing && (
            <button type="button" className="btn-secondary" onClick={reset}>
              Bekor qilish
            </button>
          )}
        </div>
      </form>
      <label className="block text-sm">
        Kategoriyani qidirish
        <input
          className="input-field mt-1"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Kategoriya nomi"
        />
      </label>
      {loading ? (
        <p>Yuklanmoqda…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {categories
            .filter((category) =>
              category.name
                .toLocaleLowerCase()
                .includes(search.toLocaleLowerCase()),
            )
            .map((category) => (
              <article
                key={category.id}
                className="rounded-2xl border bg-white p-5"
              >
                <h2 className="font-bold text-slate-900">{category.name}</h2>
                <p className="my-2 text-sm">{category.description}</p>
                <p className="text-xs">
                  {category._count.products} ta mahsulot
                </p>
                <div className="mt-4 flex gap-3">
                  <button
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() => {
                      setEditing(category.id);
                      setName(category.name);
                      setDescription(category.description || "");
                    }}
                  >
                    Tahrirlash
                  </button>
                  <button
                    className="text-sm text-red-600 disabled:opacity-40"
                    disabled={busy || category._count.products > 0}
                    onClick={() => remove(category)}
                  >
                    O‘chirish
                  </button>
                </div>
              </article>
            ))}
          {!categories.length && (
            <p>Kategoriya yarating va mahsulotlarni unga biriktiring.</p>
          )}
        </div>
      )}
    </div>
  );
}
