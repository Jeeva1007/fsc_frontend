import type { Shipment, User } from "./fsc";
import type { Warehouse } from "./warehouse";
import type { MasterOptions } from "@/types/api";

const key = (value: string | undefined) => (value ?? "").trim().toLowerCase();
const digits = (value: string | undefined) => (value ?? "").replace(/\D/g, "");

/**
 * The active Receiver members linked to a receiver, matched by party id (UUID or number) or by code / name.
 * `receiver` is the master code the form stores.
 */
export function receiverUsersFor(
  users: User[],
  receiver: string | undefined,
  master: MasterOptions | undefined,
): User[] {
  const wanted = key(receiver);
  if (!wanted) return [];
  const party = master?.["parties"]?.find((p) => key(p.code) === wanted || key(p.name) === wanted);
  const names = new Set([wanted, key(party?.code), key(party?.name)].filter(Boolean));
  return users.filter((user) => {
    if (user.role !== "Receiver" || (user.status || "Active") !== "Active") return false;
    const samePartyId =
      party !== undefined &&
      user.partyId !== undefined &&
      String(user.partyId) === String(party.id);
    return samePartyId || [user.linked, user.short, user.name].some((n) => names.has(key(n)));
  });
}

/**
 * The warehouses a shipment's receiver can deliver to: those saved in User Management on the matching active
 * Receiver members. Used as the fallback when the per-user server fetch is not available.
 */
export function warehousesForReceiver(
  users: User[],
  receiver: string | undefined,
  master: MasterOptions | undefined,
): Warehouse[] {
  const seen = new Set<string>();
  const found: Warehouse[] = [];
  for (const user of receiverUsersFor(users, receiver, master)) {
    for (const warehouse of user.warehouses ?? []) {
      const id = `${key(warehouse.name)}|${key(warehouse.location)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      found.push(warehouse);
    }
  }
  return found;
}

/** The server id of the receiver's user, used to fetch its warehouses with GET /users/getUserById. */
export function receiverUserId(
  users: User[],
  receiver: string | undefined,
  master: MasterOptions | undefined,
): string | number | undefined {
  return receiverUsersFor(users, receiver, master).find((u) => u.serverId !== undefined)?.serverId;
}

/** The warehouse a shipment points at: by server id, by name and location, or by WhatsApp when only that came from the server. */
export function matchWarehouse(list: Warehouse[], s: Shipment): Warehouse | undefined {
  const byId = s.warehouseId ? list.find((w) => w.serverId === s.warehouseId) : undefined;
  if (byId) return byId;
  const name = key(s.warehouse);
  if (name) {
    const location = key(s.warehouseLocation);
    return list.find((w) => key(w.name) === name && (!location || key(w.location) === location));
  }
  const whatsapp = digits(s.warehouseWhatsapp);
  return whatsapp ? list.find((w) => digits(w.whatsapp) === whatsapp) : undefined;
}

export const deliveryOf = (w?: Warehouse) => ({
  warehouse: w?.name ?? "",
  warehouseLocation: w?.location ?? "",
  warehouseWhatsapp: w?.whatsapp ?? "",
  warehouseId: w?.serverId ?? "",
});

/**
 * What a read-only screen shows: the chosen warehouse, a receiver's only one, or else what the shipment
 * has saved, which may be a warehouse no longer on the list.
 */
export function shownDelivery(s: Shipment, list: Warehouse[]) {
  const current = matchWarehouse(list, s) ?? (list.length === 1 ? list[0] : undefined);
  return current
    ? deliveryOf(current)
    : {
        warehouse: s.warehouse ?? "",
        warehouseLocation: s.warehouseLocation ?? "",
        warehouseWhatsapp: s.warehouseWhatsapp ?? "",
      };
}

/**
 * One warehouse: it is used automatically. Several: keeps the chosen one, or clears a choice that is no
 * longer on the list. None known: the shipment is left alone. Returns the same object when nothing changes.
 */
export function syncDelivery(s: Shipment, list: Warehouse[]): Shipment {
  if (!list.length) return s;
  const next = deliveryOf(list.length === 1 ? list[0] : matchWarehouse(list, s));
  const same =
    (s.warehouse ?? "") === next.warehouse &&
    (s.warehouseLocation ?? "") === next.warehouseLocation &&
    (s.warehouseWhatsapp ?? "") === next.warehouseWhatsapp &&
    (s.warehouseId ?? "") === next.warehouseId;
  return same ? s : { ...s, ...next };
}

/** True when the receiver has several warehouses and none has been chosen, which blocks saving. */
export const needsWarehouseChoice = (s: Shipment, list: Warehouse[]) =>
  list.length > 1 && !matchWarehouse(list, s);

/**
 * The server stores only the WhatsApp number, so a list refresh would drop the warehouse name and location.
 * Keeps them for the session, for the same shipment and receiver.
 */
export function keepDelivery(rows: Shipment[], previous: Shipment[]): Shipment[] {
  return rows.map((row) => {
    const old = previous.find((p) => p.vase === row.vase && key(p.rcv) === key(row.rcv));
    if (!old?.warehouse) return row;
    const server = digits(row.warehouseWhatsapp);
    if (server && server !== digits(old.warehouseWhatsapp)) return row;
    return {
      ...row,
      warehouse: old.warehouse,
      warehouseLocation: old.warehouseLocation ?? "",
      warehouseWhatsapp: old.warehouseWhatsapp ?? "",
      warehouseId: row.warehouseId || old.warehouseId || "",
    };
  });
}
