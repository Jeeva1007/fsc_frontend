import type { Me } from "@/types/api";

/**
 * Persists the signed-in user (the POST /auth/login reply) in sessionStorage so a page refresh keeps the
 * user signed in WITHOUT calling /auth/me (user request, 2026-11-11). This is only UI state — who to show;
 * the real session is the backend's HttpOnly cookie, which still gates every API call. If the cookie has
 * expired, the first protected call returns 401 and baseApi signs the user out and clears this store.
 *
 * sessionStorage (not localStorage) is deliberate: it survives a refresh but clears when the tab closes,
 * matching a session cookie's lifetime, so stale credentials never linger.
 */
const KEY = "fsc-session";

export function readStoredMe(): Me | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Me) : null;
  } catch {
    return null;
  }
}

export function writeStoredMe(me: Me): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(me));
  } catch {
    /* storage full or blocked: fall back to in-memory only */
  }
}

export function clearStoredMe(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
