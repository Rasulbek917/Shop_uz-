export async function clientApi(url: string, options?: RequestInit) {
  const res = await fetch(url, { cache: "no-store", ...options });
  const data = await res.json();
  if (!res.ok || !data.success) {
    if (res.status === 401) window.location.assign("/login");
    throw new Error(typeof data.error === "string" ? data.error : data.error?.message || "Amal bajarilmadi");
  }
  return data.data;
}
export const jsonOptions = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
