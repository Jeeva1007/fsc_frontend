import { useEffect, useState } from "react";
import { readStoredMe } from "./session-store";

/**
 * Remembers which tab / ledger is open on a screen, so a page refresh reopens it (user request,
 * 2026-11-16, the /ledger screen). Kept in localStorage per signed-in user, so one person's choice never
 * opens for another who signs in on the same browser. Only UI state: nothing here reaches the server.
 *
 * The remembered value is used only when the page was loaded (refreshed or opened by its link) on the
 * screen itself, and only by the views shown with it on that first load. Opening the screen from the menu,
 * or opening a view later (picking a shipper), starts on the first tab (user request, 2026-11-16).
 *
 * `isValid` rejects a stored value the screen no longer offers (a shipper removed from the list, a tab
 * this role does not have); the fallback is used instead.
 */
const PREFIX = "fsc-view";

/** The path the page was loaded on; this module is imported with the app, before any navigation. */
const loadPath = typeof window === "undefined" ? null : window.location.pathname;
/** Open until the first views using this hook have mounted; later mounts start on their fallback. */
let restoreOpen = true;

function storageKey(name: string): string | null {
  if (typeof window === "undefined") return null;
  const id = readStoredMe()?.id;
  return id === null || id === undefined || id === "" ? null : `${PREFIX}:${id}:${name}`;
}

function readView(name: string): string | null {
  if (!restoreOpen || window.location.pathname !== loadPath) return null;
  const key = storageKey(name);
  if (!key) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeView(name: string, value: string): void {
  const key = storageKey(name);
  if (!key) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage full or blocked: the choice just is not remembered */
  }
}

export function useStoredView(
  name: string,
  fallback: string,
  isValid: (value: string) => boolean = () => true,
): [string, (value: string) => void] {
  const [value, setValue] = useState(() => {
    const stored = typeof window === "undefined" ? null : readView(name);
    return stored !== null && isValid(stored) ? stored : fallback;
  });
  // Runs after the whole first screen has mounted (every view in it has read its value by then).
  useEffect(() => {
    restoreOpen = false;
  }, []);
  useEffect(() => {
    writeView(name, value);
  }, [name, value]);
  return [value, setValue];
}
