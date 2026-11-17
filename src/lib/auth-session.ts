import type { Me, SessionUser } from "@/types/api";

/**
 * Backend roles -> the app's UI role names. An unknown role gets the least-privileged one, never
 * admin. This only chooses what to show: the backend remains the sole authority on what a user may
 * read or change.
 */
const ROLE_MAP: Record<string, string> = {
  OWNER: "Admin",
  CHA: "CHA",
  SHIPPER: "Shipper",
  RECEIVER: "Receiver",
  ACCOUNTANT: "Accountant",
};
export const appRoleFor = (backendRole: string | null | undefined) =>
  ROLE_MAP[(backendRole ?? "").trim().toUpperCase()] ?? "Receiver";

/** Not signed in. */
export const SIGNED_OUT: Me = {
  signedIn: false,
  id: null,
  displayName: null,
  role: null,
  mustChangePassword: false,
};

/**
 * The newer backend wraps replies in one of two envelopes: `{ success, message, data, timestamp }` (auth)
 * or `{ message, data, result }` (`CommonResponse`, e.g. users). The deployed one sends the object itself.
 * Returns the object either way.
 */
export function isApiEnvelope(raw: unknown): raw is { data: unknown } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !("data" in raw)) return false;
  const r = raw as { success?: unknown; result?: unknown };
  return typeof r.success === "boolean" || typeof r.result === "string";
}
export function unwrapApi(raw: unknown): unknown {
  return isApiEnvelope(raw) ? raw.data : raw;
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Either backend's current-user or login reply as the app's `Me`. The deployed backend sends `signedIn`;
 * the newer one sends `authenticated` on /auth/me and nothing on /auth/login (a reply there means success).
 * The newer one has no forced password change, so `mustChangePassword` is false unless sent.
 */
export function toMe(raw: unknown): Me {
  const body = unwrapApi(raw);
  if (!body || typeof body !== "object") return SIGNED_OUT;
  const b = body as {
    id?: unknown;
    signedIn?: unknown;
    authenticated?: unknown;
    displayName?: unknown;
    username?: unknown;
    role?: unknown;
    mustChangePassword?: unknown;
  };
  const id = typeof b.id === "number" && Number.isFinite(b.id) ? b.id : text(b.id);
  const signedIn =
    typeof b.signedIn === "boolean"
      ? b.signedIn
      : typeof b.authenticated === "boolean"
        ? b.authenticated
        : id !== null;
  return {
    signedIn,
    id,
    displayName: text(b.displayName) ?? text(b.username),
    role: text(b.role),
    mustChangePassword: b.mustChangePassword === true,
  };
}

/** Turns the backend `Me` into the app's session member, or null when not signed in. */
export function sessionFromMe(me: Me | null | undefined): SessionUser | null {
  const hasId = typeof me?.id === "number" || (typeof me?.id === "string" && me.id !== "");
  if (!me || me.signedIn !== true || !hasId) return null;
  const name = (me.displayName ?? "").trim() || `User ${me.id}`;
  return {
    name,
    username: `u${me.id}`,
    short: name,
    role: appRoleFor(me.role),
    country: "—",
    port: "—",
    status: "Active",
  };
}

/**
 * What a POST /auth/login or /auth/totp/verify reply means. When the member's 15-day Google Authenticator
 * access has run out, login accepts the password but answers `status: "TOTP_SETUP_REQUIRED"` (maybe with
 * the member's id): that is NOT a session, the member must still enter an authenticator code.
 */
export type LoginStep = { kind: "signedIn"; me: Me } | { kind: "totpRequired" };

export function readLoginReply(raw: unknown): LoginStep {
  const body = unwrapApi(raw);
  const status =
    body && typeof body === "object" ? text((body as { status?: unknown }).status) : null;
  // Only TOTP_* statuses ask for a code. Any other `status` (e.g. a member's "Active") is not a login step.
  if (status && /^TOTP_/i.test(status)) return { kind: "totpRequired" };
  return { kind: "signedIn", me: toMe(raw) };
}

/** POST /auth/totp/setup reply: the QR code to scan (the same one for the whole 15-day cycle). */
export type TotpSetup = {
  /** A data: URL or image URL, used directly as the <img> src. */
  qrCodeImage: string | null;
  manualEntryKey: string | null;
  issuer: string | null;
  accountName: string | null;
  digits: number;
  validDays: number | null;
};

const count = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null);

// A bare base64 PNG (no "data:" prefix) is turned into a data URL so it still shows.
const qrSrc = (v: string | null) =>
  v && v.startsWith("iVBORw0KGgo") ? `data:image/png;base64,${v}` : v;

export function toTotpSetup(raw: unknown): TotpSetup {
  const body = unwrapApi(raw);
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  return {
    qrCodeImage: qrSrc(text(b["qrCodeImage"])),
    manualEntryKey: text(b["manualEntryKey"]),
    issuer: text(b["issuer"]),
    accountName: text(b["accountName"]),
    digits: count(b["digits"]) ?? 6,
    validDays: count(b["validDays"]),
  };
}
