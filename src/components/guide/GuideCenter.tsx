"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { defaultGuideLessons, guideCategories, youtubeEmbedUrl, type GuideLanguage, type GuideLesson } from "@/lib/guide-lessons";

type LessonForm = Omit<GuideLesson, "custom"> & { stepsUz: string; stepsEn: string };

function toForm(lesson?: GuideLesson): LessonForm {
  return { id: lesson?.id || "", category: lesson?.category || "setup", title: lesson?.title || { uz: "", en: "" }, description: lesson?.description || { uz: "", en: "" }, steps: lesson?.steps || { uz: [], en: [] }, stepsUz: lesson?.steps.uz.join("\n") || "", stepsEn: lesson?.steps.en.join("\n") || "", sourceUrl: lesson?.sourceUrl || "", startSeconds: lesson?.startSeconds ?? 0, endSeconds: lesson?.endSeconds ?? 120 };
}

function duration(seconds: number) { const value = Math.max(0, Math.round(seconds)); return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`; }
function progressKey(userId: string, lessonId: string) { return `savdoza-guide-${userId}-${lessonId}`; }

export default function GuideCenter({ userId, canEdit, initialLessonId }: { userId: string; canEdit: boolean; initialLessonId?: string }) {
  const [lessons, setLessons] = useState<GuideLesson[]>(defaultGuideLessons);
  const [activeId, setActiveId] = useState(initialLessonId || defaultGuideLessons[0].id);
  const [language, setLanguage] = useState<GuideLanguage>("uz");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [watched, setWatched] = useState<Record<string, boolean>>({});
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState<LessonForm | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSavedSecond = useRef(-1);

  useEffect(() => {
    const storedLanguage = localStorage.getItem("savdoza-language");
    if (storedLanguage === "en") setLanguage("en");
    const onLanguage = (event: Event) => setLanguage((event as CustomEvent<GuideLanguage>).detail);
    window.addEventListener("savdoza-language-changed", onLanguage);
    return () => window.removeEventListener("savdoza-language-changed", onLanguage);
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch("/api/guide-videos", { cache: "no-store" }).then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(typeof result.error === "string" ? result.error : "Video darslar yuklanmadi");
      if (mounted) setLessons(result.data);
    }).catch((cause) => { if (mounted) setError(cause.message); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    lessons.forEach((lesson) => { try { next[lesson.id] = JSON.parse(localStorage.getItem(progressKey(userId, lesson.id)) || "{}").watched === true; } catch { next[lesson.id] = false; } });
    setWatched(next);
  }, [lessons, userId]);

  const active = lessons.find((lesson) => lesson.id === activeId) || lessons[0];
  const filtered = useMemo(() => lessons.filter((lesson) => (category === "all" || lesson.category === category) && `${lesson.title[language]} ${lesson.description[language]}`.toLowerCase().includes(query.toLowerCase().trim())), [lessons, category, query, language]);

  function markWatched(lesson: GuideLesson, value: boolean) {
    setWatched((current) => ({ ...current, [lesson.id]: value }));
    let saved: { second?: number } = {};
    try { saved = JSON.parse(localStorage.getItem(progressKey(userId, lesson.id)) || "{}"); } catch { /* reset invalid browser data */ }
    localStorage.setItem(progressKey(userId, lesson.id), JSON.stringify({ ...saved, watched: value }));
  }

  function rememberTime(lesson: GuideLesson, second: number) {
    const rounded = Math.floor(second);
    if (rounded === lastSavedSecond.current) return;
    lastSavedSecond.current = rounded;
    localStorage.setItem(progressKey(userId, lesson.id), JSON.stringify({ second: rounded, watched: watched[lesson.id] || false }));
  }

  function onLoaded() {
    if (!active || !videoRef.current) return;
    lastSavedSecond.current = -1;
    let second = active.startSeconds;
    try { const saved = JSON.parse(localStorage.getItem(progressKey(userId, active.id)) || "{}"); if (saved.second >= active.startSeconds && saved.second < active.endSeconds - 2) second = saved.second; } catch { /* start from beginning */ }
    videoRef.current.currentTime = second;
    videoRef.current.playbackRate = speed;
  }

  function onTimeUpdate() {
    if (!active || !videoRef.current) return;
    const second = videoRef.current.currentTime;
    if (second >= active.endSeconds - 0.2) { videoRef.current.pause(); rememberTime(active, active.startSeconds); markWatched(active, true); return; }
    rememberTime(active, second);
  }

  async function saveLesson(event: React.FormEvent) {
    event.preventDefault();
    if (!form || saving) return;
    setSaving(true); setError(""); setMessage("");
    const { stepsUz, stepsEn, ...fields } = form;
    const body = { ...fields, id: fields.id || undefined, startSeconds: Number(fields.startSeconds), endSeconds: Number(fields.endSeconds), steps: { uz: stepsUz.split("\n").map((line) => line.trim()).filter(Boolean), en: stepsEn.split("\n").map((line) => line.trim()).filter(Boolean) } };
    try {
      const response = await fetch("/api/guide-videos", { method: fields.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(typeof result.error === "string" ? result.error : "Saqlab bo‘lmadi");
      setLessons(result.data); setActiveId(fields.id || result.data[result.data.length - 1].id); setForm(null); setMessage(language === "uz" ? "Video dars saqlandi" : "Lesson saved");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Saqlab bo‘lmadi"); }
    finally { setSaving(false); }
  }

  async function removeLesson(lesson: GuideLesson) {
    if (!window.confirm(lesson.custom ? "Bu video dars o‘chirilsinmi?" : "Bu dars asl holatiga qaytarilsinmi?")) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/guide-videos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: lesson.id }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(typeof result.error === "string" ? result.error : "O‘chirib bo‘lmadi");
      setLessons(result.data); setActiveId(result.data.some((item: GuideLesson) => item.id === activeId) ? activeId : result.data[0]?.id); setMessage("Video dars yangilandi");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "O‘chirib bo‘lmadi"); }
    finally { setSaving(false); }
  }

  const youtube = active ? youtubeEmbedUrl(active.sourceUrl) : null;
  return <div className="guide-center space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4"><div><h1 className="text-xl font-semibold text-slate-900">{language === "uz" ? "Video qo‘llanma" : "Video guide"}</h1><p className="mt-1 text-sm text-slate-500">{language === "uz" ? "Mavzuni tanlang, videoni ko‘ring yoki qadamlarni o‘qing." : "Choose a topic, watch the video or read the steps."}</p></div>{canEdit && <button type="button" onClick={() => setForm(toForm())} className="inline-flex items-center gap-2 border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-medium text-white"><Plus size={16} />{language === "uz" ? "Video qo‘shish" : "Add video"}</button>}</header>
    {loading && <p role="status" className="text-sm text-slate-500">{language === "uz" ? "Darslar yuklanmoqda..." : "Loading lessons..."}</p>}
    {error && <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</p>}
    <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-3 border border-slate-200 bg-white p-3"><label className="flex items-center gap-2 border border-slate-200 px-2 text-slate-500"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={language === "uz" ? "Darsni qidirish" : "Search lessons"} className="h-9 w-full outline-none" /></label><select aria-label={language === "uz" ? "Kategoriya" : "Category"} value={category} onChange={(event) => setCategory(event.target.value)} className="h-9 w-full border border-slate-200 px-2 text-sm"><option value="all">{language === "uz" ? "Barcha mavzular" : "All topics"}</option>{Object.entries(guideCategories).map(([key, labels]) => <option key={key} value={key}>{labels[language]}</option>)}</select><div className="max-h-[65vh] space-y-1 overflow-y-auto">{filtered.length ? filtered.map((lesson) => <button key={lesson.id} type="button" onClick={() => { setActiveId(lesson.id); setSpeed(1); setError(""); }} className={`w-full border px-3 py-2 text-left text-sm ${active?.id === lesson.id ? "border-blue-500 bg-blue-50" : "border-transparent hover:bg-slate-50"}`}><span className="flex items-center justify-between gap-2"><strong className="font-medium text-slate-900">{lesson.title[language]}</strong>{watched[lesson.id] && <Check size={15} className="shrink-0 text-green-600" aria-label={language === "uz" ? "Ko‘rildi" : "Watched"} />}</span><span className="mt-1 block text-xs text-slate-500">{guideCategories[lesson.category]?.[language]} · {duration(lesson.endSeconds - lesson.startSeconds)}{watched[lesson.id] ? ` · ${language === "uz" ? "Ko‘rildi" : "Watched"}` : ""}</span></button>) : <p className="p-3 text-sm text-slate-500">{language === "uz" ? "Ma’lumot topilmadi" : "No lessons found"}</p>}</div></aside>
      {active && <section className="min-w-0 space-y-4"><div className="border border-slate-200 bg-white p-3 sm:p-4"><div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs text-slate-500">{guideCategories[active.category]?.[language]} · {duration(active.endSeconds - active.startSeconds)}</p><h2 className="mt-1 text-lg font-semibold text-slate-900">{active.title[language]}</h2><p className="mt-1 text-sm text-slate-600">{active.description[language]}</p></div>{canEdit && <div className="flex gap-2"><button type="button" onClick={() => setForm(toForm(active))} className="border border-slate-200 p-2" aria-label="Tahrirlash" title="Tahrirlash"><Pencil size={16} /></button>{(active.custom || active.overridden) && <button type="button" onClick={() => removeLesson(active)} disabled={saving} className="border border-slate-200 p-2 text-red-600" aria-label={active.custom ? "O‘chirish" : "Asliga qaytarish"} title={active.custom ? "O‘chirish" : "Asliga qaytarish"}><Trash2 size={16} /></button>}</div>}</div>{youtube ? <iframe key={active.id} src={`${youtube}?start=${Math.floor(active.startSeconds)}`} title={active.title[language]} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen className="aspect-video w-full border border-slate-200" /> : <video key={active.id} ref={videoRef} src={active.sourceUrl} controls playsInline preload="metadata" onLoadedMetadata={onLoaded} onTimeUpdate={onTimeUpdate} onEnded={() => markWatched(active, true)} className="aspect-video w-full bg-slate-900" />}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm text-slate-600">{language === "uz" ? "Tezlik" : "Speed"}<select value={speed} onChange={(event) => { const next = Number(event.target.value); setSpeed(next); if (videoRef.current) videoRef.current.playbackRate = next; }} disabled={!!youtube} className="border border-slate-200 px-2 py-1"><option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.5}>1.5×</option></select></label><button type="button" onClick={() => markWatched(active, !watched[active.id])} className="border border-slate-200 px-3 py-1.5 text-sm">{watched[active.id] ? (language === "uz" ? "Ko‘rildi ✓" : "Watched ✓") : (language === "uz" ? "Ko‘rildi deb belgilash" : "Mark as watched")}</button></div></div><div className="border border-slate-200 bg-white p-4"><h3 className="text-base font-semibold text-slate-900">{language === "uz" ? "Qadamlar" : "Steps"}</h3><ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-slate-700">{active.steps[language].map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol></div></section>}
    </div>
    {form && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" role="presentation"><form onSubmit={saveLesson} role="dialog" aria-modal="true" aria-label={form.id ? "Video darsni tahrirlash" : "Video dars qo‘shish"} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto border border-slate-200 bg-white p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{form.id ? "Video darsni tahrirlash" : "Video dars qo‘shish"}</h2><button type="button" onClick={() => setForm(null)} className="border border-slate-200 px-2 py-1">Yopish</button></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Sarlavha (UZ)<input required value={form.title.uz} onChange={(event) => setForm({ ...form, title: { ...form.title, uz: event.target.value } })} className="mt-1 w-full border border-slate-200 p-2" /></label><label className="text-sm">Title (EN)<input required value={form.title.en} onChange={(event) => setForm({ ...form, title: { ...form.title, en: event.target.value } })} className="mt-1 w-full border border-slate-200 p-2" /></label><label className="text-sm">Tavsif (UZ)<input required value={form.description.uz} onChange={(event) => setForm({ ...form, description: { ...form.description, uz: event.target.value } })} className="mt-1 w-full border border-slate-200 p-2" /></label><label className="text-sm">Description (EN)<input required value={form.description.en} onChange={(event) => setForm({ ...form, description: { ...form.description, en: event.target.value } })} className="mt-1 w-full border border-slate-200 p-2" /></label><label className="text-sm">Kategoriya<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-1 w-full border border-slate-200 p-2">{Object.entries(guideCategories).map(([key, labels]) => <option key={key} value={key}>{labels.uz}</option>)}</select></label><label className="text-sm">MP4 yoki YouTube havolasi<input required value={form.sourceUrl} onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })} placeholder="https://.../video.mp4" className="mt-1 w-full border border-slate-200 p-2" /></label><label className="text-sm">Boshlanish (soniya)<input required type="number" min="0" value={form.startSeconds} onChange={(event) => setForm({ ...form, startSeconds: Number(event.target.value) })} className="mt-1 w-full border border-slate-200 p-2" /></label><label className="text-sm">Tugash (soniya)<input required type="number" min="1" value={form.endSeconds} onChange={(event) => setForm({ ...form, endSeconds: Number(event.target.value) })} className="mt-1 w-full border border-slate-200 p-2" /></label><label className="text-sm">Qadamlar (UZ), har qadam alohida qatorda<textarea required rows={5} value={form.stepsUz} onChange={(event) => setForm({ ...form, stepsUz: event.target.value })} className="mt-1 w-full border border-slate-200 p-2" /></label><label className="text-sm">Steps (EN), one per line<textarea required rows={5} value={form.stepsEn} onChange={(event) => setForm({ ...form, stepsEn: event.target.value })} className="mt-1 w-full border border-slate-200 p-2" /></label></div>{error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}<div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setForm(null)} className="border border-slate-200 px-4 py-2 text-sm">Bekor qilish</button><button type="submit" disabled={saving} className="bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? "Saqlanmoqda..." : "Saqlash"}</button></div></form></div>}
  </div>;
}
