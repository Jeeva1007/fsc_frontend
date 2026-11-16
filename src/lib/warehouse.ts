import * as yup from "yup";
import { validateForm, type FieldErrors } from "./login-schema";
import type { WarehouseCreate, WarehouseRow, WarehouseUpdate } from "@/types/api";

export type Warehouse = {
  /** Client-side key only; not shown to users. */
  id: string;
  name: string;
  location: string;
  whatsapp: string;
  /** The server's id, once POST /warehouses/create has saved it. */
  serverId?: string;
  /** Not shown; sent back unchanged so an update cannot erase it. */
  optedInOn?: string;
};

export const MAX_WAREHOUSES = 20;
// The location limit matches the backend's WarehouseRequest.location (120).
export const WAREHOUSE_LIMITS = { name: 100, location: 120, whatsapp: 20 } as const;

let counter = 0;
export const newWarehouse = (): Warehouse => ({
  id: `wh-${Date.now().toString(36)}-${(counter++).toString(36)}`,
  name: "",
  location: "",
  whatsapp: "",
});

// People enter a plain 10-digit number; the server requires "+" and a country code, so India's is added.
const COUNTRY_CODE = "+91";
const normalizedWhatsapp = (value: string) => value.replace(/[\s\-()]/g, "");
const WITH_INDIA_CODE = /^\+?91\d{10}$/;
/** Valid: 10 digits with no leading zero, or a full international number already on record. */
export const isValidWhatsapp = (value: string) => {
  const n = normalizedWhatsapp(value);
  return /^[1-9]\d{9}$/.test(n) || /^\+[1-9]\d{7,14}$/.test(n);
};
/** What the input shows: the number without India's code. */
export const whatsappForInput = (value: string) => {
  const n = normalizedWhatsapp(value);
  return WITH_INDIA_CODE.test(n) ? n.slice(-10) : value;
};
/** Keeps what was typed or pasted to digits only, at most 10; a pasted +91 is dropped. */
export const typedWhatsapp = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const hasCode = value.trim().startsWith(COUNTRY_CODE) || /^91\d{10}$/.test(digits);
  return (hasCode ? digits.slice(2) : digits).slice(0, 10);
};
/** The number as stored and sent: "+" and country code, no spaces. */
export const fullWhatsapp = (value: string) => {
  const n = normalizedWhatsapp(value);
  return /^\d{10}$/.test(n) ? `${COUNTRY_CODE}${n}` : n;
};

const warehouseSchema = yup.object({
  name: yup
    .string()
    .trim()
    .required("Enter the warehouse name.")
    .max(
      WAREHOUSE_LIMITS.name,
      `Warehouse name must be ${WAREHOUSE_LIMITS.name} characters or fewer.`,
    ),
  // Once a warehouse name is entered, location and WhatsApp number are required too.
  location: yup
    .string()
    .trim()
    .when("name", ([name], schema) =>
      String(name ?? "").trim() ? schema.required("Enter the location or description.") : schema,
    )
    .max(
      WAREHOUSE_LIMITS.location,
      `Location must be ${WAREHOUSE_LIMITS.location} characters or fewer.`,
    ),
  whatsapp: yup
    .string()
    .trim()
    .when("name", ([name], schema) =>
      String(name ?? "").trim() ? schema.required("Enter the WhatsApp number.") : schema,
    )
    .test("whatsapp", "Enter a 10-digit WhatsApp number, e.g. 9876543210.", (v) =>
      !v ? true : isValidWhatsapp(v),
    ),
});

/** Warehouse card -> POST /warehouses/create body. */
export const toWarehouseCreate = (w: Warehouse, partyId: number): WarehouseCreate => ({
  partyId,
  name: w.name.trim(),
  address: w.location.trim(),
  whatsappNumber: fullWhatsapp(w.whatsapp.trim()),
  isActive: true,
});

/** POST /warehouses/list rows -> warehouse cards. Deactivated warehouses are left out; the server sends unset fields as null. */
export const fromWarehouseRows = (rows: WarehouseRow[]): Warehouse[] =>
  rows
    .filter((row) => row.isActive !== false)
    .map((row) => ({
      ...newWarehouse(),
      ...(row.id ? { id: row.id, serverId: row.id } : {}),
      name: row.name ?? "",
      location: row.address ?? "",
      whatsapp: row.whatsappNumber ?? "",
      ...(row.whatsappOptedInOn ? { optedInOn: row.whatsappOptedInOn } : {}),
    }));

/** Warehouse card -> PUT /warehouses/update body. */
export const toWarehouseUpdate = (
  w: Warehouse,
  partyId: number,
  isActive = true,
): WarehouseUpdate => ({
  ...toWarehouseCreate(w, partyId),
  warehouseId: w.serverId ?? "",
  isActive,
  ...(w.optedInOn ? { whatsappOptedInOn: w.optedInOn } : {}),
});

const sameWarehouse = (a: Warehouse, b: Warehouse) =>
  a.name.trim() === b.name.trim() &&
  a.location.trim() === b.location.trim() &&
  fullWhatsapp(a.whatsapp) === fullWhatsapp(b.whatsapp);

/**
 * What Save has to send, comparing the cards with what the server returned: `save` holds new and changed
 * cards (a card with no serverId is new), `removed` the server's warehouses whose card was taken away.
 */
export function planWarehouseChanges(loaded: Warehouse[], cards: Warehouse[]) {
  const isUnchanged = (w: Warehouse) => {
    const before = loaded.find((l) => l.serverId && l.serverId === w.serverId);
    return before !== undefined && sameWarehouse(before, w);
  };
  return {
    save: cards.filter((w) => !isUnchanged(w)),
    unchanged: cards.filter(isUnchanged),
    removed: loaded.filter((l) => !cards.some((w) => w.serverId === l.serverId)),
  };
}

export type WarehouseSaveResult = {
  saved: Warehouse[];
  failed: { warehouse: Warehouse; message: string }[];
  failedRemovals?: { warehouse: Warehouse; message: string }[];
};

/** Sends the cards one at a time and carries on past a failure, so a retry only has to send what failed. */
export async function sendWarehouses(
  list: Warehouse[],
  send: (w: Warehouse) => Promise<{ id?: string | undefined } | { error: string }>,
  removed: Warehouse[] = [],
  remove?: (w: Warehouse) => Promise<{ error?: string }>,
): Promise<WarehouseSaveResult> {
  const result: WarehouseSaveResult = { saved: [], failed: [], failedRemovals: [] };
  for (const warehouse of list) {
    const reply = await send(warehouse);
    if ("error" in reply) result.failed.push({ warehouse, message: reply.error });
    else result.saved.push({ ...warehouse, ...(reply.id ? { serverId: reply.id } : {}) });
  }
  for (const warehouse of removed) {
    const reply = await remove?.(warehouse);
    if (reply?.error) result.failedRemovals?.push({ warehouse, message: reply.error });
  }
  return result;
}

export const isBlankWarehouse = (w: Warehouse) =>
  !w.name.trim() && !w.location.trim() && !w.whatsapp.trim();

/**
 * Drops completely empty cards, validates the rest and returns trimmed copies.
 * `errors[i]` lines up with the index in the list that was passed in.
 */
export function checkWarehouses(list: Warehouse[]): {
  cleaned: Warehouse[];
  errors: FieldErrors[];
  valid: boolean;
} {
  const errors: FieldErrors[] = list.map(() => ({}));
  const cleaned: Warehouse[] = [];
  let valid = true;
  list.forEach((w, i) => {
    if (isBlankWarehouse(w)) return;
    const found = validateForm(warehouseSchema, w);
    if (found) {
      errors[i] = found;
      valid = false;
    }
    cleaned.push({
      ...w,
      name: w.name.trim(),
      location: w.location.trim(),
      whatsapp: fullWhatsapp(w.whatsapp.trim()),
    });
  });
  return { cleaned, errors, valid };
}
