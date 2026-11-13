let sessionCheck: Promise<boolean> | null = null;

async function sessionExpired(): Promise<boolean> {
  if (!sessionCheck) {
    sessionCheck = fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" })
      .then(response => response.status === 401)
      .catch(() => false)
      .finally(() => { sessionCheck = null; });
  }
  return sessionCheck;
}

export async function clientApi(url: string, options?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...options });
  } catch {
    throw new Error("Serverga ulanib bo‘lmadi. Internet aloqasini tekshirib, qayta urinib ko‘ring.");
  }
  if (res.status === 401 && await sessionExpired()) window.location.assign("/login");
  const data = await res.json().catch(() => null);
  if (!data) throw new Error("Server javobi olinmadi. Biroz kutib, qayta urinib ko‘ring.");
  if (!res.ok || !data.success) {
    throw new Error(typeof data.error === "string" ? data.error : data.error?.message || "Amal bajarilmadi");
  }
  return data.data;
}
export const jsonOptions = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
