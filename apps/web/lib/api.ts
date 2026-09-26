export const API = "/api";
export function currentUser() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(sessionStorage.getItem("lead2_user") || "null");
  } catch {
    return null;
  }
}
export function setSession(data: any) {
  if (data?.user || data?.sub)
    sessionStorage.setItem("lead2_user", JSON.stringify(data.user || data));
}
export function clearSession() {
  sessionStorage.removeItem("lead2_user");
  localStorage.removeItem("crm_token");
  localStorage.removeItem("crm_user");
}
export async function api(path: string, options: RequestInit = {}) {
  const r = await fetch(`${API}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Lead2-CSRF": "1",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });
  const raw = await r.text();
  let body: any;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = raw;
  }
  if (!r.ok) {
    if (
      r.status === 401 &&
      !path.includes("login") &&
      typeof window !== "undefined"
    ) {
      clearSession();
      if (
        !location.pathname.includes("login") &&
        !location.pathname.includes("register")
      )
        location.href = "/login";
    }
    throw new Error(
      Array.isArray(body?.message)
        ? body.message.join(", ")
        : body?.message || `Request failed (${r.status})`,
    );
  }
  return body;
}
export async function signIn(body: any, platform = false) {
  await api(platform ? "/auth/super-admin/login" : "/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const user = await api("/auth/me");
  setSession(user);
  return user;
}
export async function signOut() {
  try {
    await api("/auth/logout", { method: "POST" });
  } finally {
    clearSession();
    location.href = "/login";
  }
}
export const can = (u: any, p: string) =>
  u?.permissions?.includes("*") || u?.permissions?.includes(p);
export function money(n: any, currency?: string) {
  const code = currency || currentUser()?.currency || "INR";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 2,
  }).format(Number(n || 0));
}
export function shortMoney(n: any, currency?: string) {
  const code = currency || currentUser()?.currency || "INR";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(n || 0));
}
export const date = (x: any) =>
  x
    ? new Date(x).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
export const label = (x: string) =>
  String(x || "")
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
export async function downloadDocument(id: string, title: string) {
  const r = await fetch(`${API}/proposals/${id}/document`, {
    credentials: "include",
  });
  if (!r.ok) throw new Error("Could not download proposal");
  const url = URL.createObjectURL(await r.blob()),
    a = document.createElement("a");
  a.href = url;
  a.download = title.replace(/[^a-z0-9-]/gi, "-") + ".html";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
