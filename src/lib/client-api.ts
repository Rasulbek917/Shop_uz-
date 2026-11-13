export async function clientApi(url: string, options?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...options });
  } catch {
    throw new Error("Serverga ulanib bo‘lmadi. Internet aloqasini tekshirib, qayta urinib ko‘ring.");
  }
  if (res.status === 401) window.location.assign("/login");
  const data = await res.json().catch(() => null);
  if (!data) throw new Error("Server javobi olinmadi. Biroz kutib, qayta urinib ko‘ring.");
  if (!res.ok || !data.success) {
    throw new Error(typeof data.error === "string" ? data.error : data.error?.message || "Amal bajarilmadi");
  }
  return data.data;
}
export const jsonOptions = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
