import type { User } from "@/lib/fsc";
import type { AuditParams } from "@/types/api";

type Item = Record<string, unknown>;

export type AuditTone = "create" | "update" | "delete" | "session" | "other";
export type AuditChange = { field: string; from: string; to: string };
export type AuditEntry = {
  key: string;
  /** Raw server timestamp; see formatAuditTime. */
  at: string;
  actor: string;
  actorEmail: string;
  actorId: string;
  action: string;
  tone: AuditTone;
  resource: string;
  rowKey: string;
  changes: AuditChange[];
  note: string;
  ip: string;
};

const present = (v: unknown) => v !== undefined && v !== null && v !== "";
const first = (i: Item, keys: string[]) => keys.map((k) => i[k]).find(present);
const text = (v: unknown) => (present(v) ? String(v) : "");

const ACRONYMS = new Set([
  "agv",
  "be",
  "bl",
  "cha",
  "eta",
  "gsm",
  "id",
  "ip",
  "ox",
  "pi",
  "pod",
  "pol",
  "tp",
  "tpt",
]);

/** "shipment_payments" / "shipmentPayment" -> "Shipment Payments"; business abbreviations stay capitals ("beNo" -> "BE No"). */
export const humanize = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\S+/g, (w) =>
      ACRONYMS.has(w.toLowerCase())
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    );

/** Audit data can hold credentials, so their values are never shown or exported, whatever the server sends. */
const SENSITIVE = /pass(word|wd)?|secret|token|hash|salt|otp|credential|api_?key/i;
const MASK = "••••••";
/** Shown for a value that was absent: nothing before a create, nothing after a delete. */
export const EMPTY_VALUE = "—";

const display = (field: string, value: unknown): string => {
  if (!present(value)) return EMPTY_VALUE;
  if (SENSITIVE.test(field)) return MASK;
  return typeof value === "object" ? JSON.stringify(value) : String(value);
};

const ACTIONS: { test: RegExp; label: string; tone: AuditTone }[] = [
  { test: /^(i|c|insert|create|created|add|added)$/i, label: "Create", tone: "create" },
  { test: /^(u|update|updated|edit|edited|change|changed)$/i, label: "Update", tone: "update" },
  { test: /^(d|delete|deleted|remove|removed)$/i, label: "Delete", tone: "delete" },
  { test: /^(approve|approved)$/i, label: "Approve", tone: "create" },
  { test: /^(reject|rejected)$/i, label: "Reject", tone: "delete" },
  { test: /^(reversal|reverse|reversed)$/i, label: "Reversal", tone: "delete" },
  { test: /^(login_?failed|failed_?login)$/i, label: "Login Failed", tone: "delete" },
  { test: /^(login|sign_?in|logged_?in)$/i, label: "Login", tone: "session" },
  { test: /^(logout|sign_?out|logged_?out)$/i, label: "Logout", tone: "session" },
];

/** Before / after values may arrive as objects or as JSON text. */
const asObject = (v: unknown): Item | undefined => {
  let value = v;
  if (typeof value === "string" && /^\s*\{/.test(value)) {
    try {
      value = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Item)
    : undefined;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function diff(before: unknown, after: unknown): AuditChange[] {
  const oldRow = asObject(before);
  const newRow = asObject(after);
  if (!oldRow && !newRow) {
    if (!present(before) && !present(after)) return [];
    return [{ field: "Value", from: display("value", before), to: display("value", after) }];
  }
  const keys = new Set([...Object.keys(oldRow ?? {}), ...Object.keys(newRow ?? {})]);
  return [...keys]
    .filter((k) => !same(oldRow?.[k], newRow?.[k]))
    .map((k) => ({
      field: humanize(k),
      from: display(k, oldRow?.[k]),
      to: display(k, newRow?.[k]),
    }));
}

const AT = [
  "at",
  "changedAt",
  "createdAt",
  "timestamp",
  "occurredAt",
  "eventTime",
  "loggedAt",
  "time",
  "ts",
];
const ACTOR = [
  "actorName",
  "userName",
  "username",
  "changedBy",
  "displayName",
  "actor",
  "performedBy",
  "createdBy",
  "user",
];
const ACTION = ["action", "operation", "op", "event", "actionType", "changeType", "type"];
const TABLE = ["table", "tableName", "entity", "entityType", "resource", "resourceType", "module"];
const ROW = ["rowKey", "recordId", "entityId", "resourceId", "rowId", "key"];
const BEFORE = [
  "oldValues",
  "oldValue",
  "old",
  "before",
  "oldData",
  "previous",
  "beforeJson",
  "oldJson",
];
const AFTER = [
  "newValues",
  "newValue",
  "new",
  "after",
  "newData",
  "current",
  "afterJson",
  "newJson",
];
const NOTE = ["details", "detail", "description", "message", "note", "summary", "reason"];
const IP = ["ip", "ipAddress", "remoteAddr", "clientIp"];
const USER_ID = ["userId", "actorId", "changedById"];
const EMAIL = ["actorEmail", "userEmail", "email"];
const KNOWN = new Set([
  "id",
  "auditId",
  "changes",
  "diff",
  ...AT,
  ...ACTOR,
  ...ACTION,
  ...TABLE,
  ...ROW,
  ...BEFORE,
  ...AFTER,
  ...NOTE,
  ...IP,
  ...USER_ID,
  ...EMAIL,
]);

const actorName = (i: Item) => {
  const value = first(i, ACTOR);
  const nested = asObject(value);
  if (nested) return text(first(nested, ["displayName", "fullName", "username", "name", "email"]));
  if (present(value)) return String(value);
  const id = first(i, USER_ID);
  return present(id) ? `User #${String(id)}` : "System";
};

const actorEmail = (i: Item) => {
  const nested = asObject(first(i, ACTOR));
  return text(first(i, EMAIL) ?? (nested && nested["email"]));
};

/**
 * Who to show for an entry: the name in the log, else the matching member's name, plus their email.
 * A log that records only an email has no name unless that member is known.
 */
export function auditPerson(
  e: AuditEntry,
  members: Pick<User, "name" | "username" | "serverId" | "email">[] = [],
) {
  const isEmail = e.actor.includes("@");
  const email = e.actorEmail || (isEmail ? e.actor : "");
  const member = members.find(
    (m) =>
      (e.actorId && String(m.serverId) === e.actorId) ||
      (email && m.email?.toLowerCase() === email.toLowerCase()) ||
      m.username.toLowerCase() === e.actor.toLowerCase(),
  );
  const logged = isEmail || e.actor.startsWith("User #") || e.actor === member?.username;
  return {
    name: (logged ? "" : e.actor) || member?.name || (isEmail ? "" : e.actor),
    email: email || member?.email || "",
  };
}

/**
 * Maps one GET /audit row to what the screen shows. The rows are untyped in the OpenAPI document, so each
 * value is looked up under its likely names, and anything unrecognised is still shown rather than hidden.
 */
export function fromAuditItem(i: Item, index: number): AuditEntry {
  const rawAction = text(first(i, ACTION));
  const action = ACTIONS.find((a) => a.test.test(rawAction.trim()));
  const list = i["changes"] ?? i["diff"];
  const changes = Array.isArray(list)
    ? (list as Item[]).map((c) => {
        const field = text(first(c, ["field", "column", "name", "key"]));
        return {
          field: humanize(field) || "Value",
          from: display(field, first(c, ["from", "old", "oldValue", "before"])),
          to: display(field, first(c, ["to", "new", "newValue", "after"])),
        };
      })
    : diff(first(i, BEFORE), first(i, AFTER));
  const leftovers = Object.keys(i)
    .filter((k) => !KNOWN.has(k) && present(i[k]))
    .map((k) => `${humanize(k)}: ${display(k, i[k])}`);
  return {
    key: `${text(first(i, ["id", "auditId"])) || "row"}-${index}`,
    at: text(first(i, AT)),
    actor: actorName(i),
    actorEmail: actorEmail(i),
    actorId: text(first(i, USER_ID)),
    action: action?.label ?? (humanize(rawAction) || "Activity"),
    tone: action?.tone ?? "other",
    resource: humanize(text(first(i, TABLE))) || "—",
    rowKey: text(first(i, ROW)),
    changes,
    note: [text(first(i, NOTE)), ...leftovers].filter(Boolean).join(" · "),
    ip: text(first(i, IP)),
  };
}

/** "Oct 24, 2026, 14:32" in the viewer's own time zone; text the browser cannot parse is shown as it came. */
export function formatAuditTime(value: string, timeZone?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

export const auditDetails = (e: AuditEntry) =>
  [
    ...e.changes.map((c) => {
      const values = [c.from, c.to].filter((v) => v !== EMPTY_VALUE);
      return `${c.field}: ${values.join(" → ") || EMPTY_VALUE}`;
    }),
    e.note,
    e.ip ? `IP ${e.ip}` : "",
  ]
    .filter(Boolean)
    .join("; ");

/** Query for GET /audit: 1-based screen page -> 0-based server page; blank filters are left out. */
export function auditParams(filters: {
  table: string;
  userId: string;
  from: string;
  to: string;
  page: number;
  size: number;
}): AuditParams {
  return {
    page: filters.page - 1,
    size: filters.size,
    ...(filters.table ? { table: filters.table } : {}),
    ...(filters.userId ? { userId: Number(filters.userId) } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  };
}
