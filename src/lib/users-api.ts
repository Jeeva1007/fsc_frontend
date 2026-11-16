import type { User } from "./fsc";
import { fullWhatsapp, newWarehouse, type Warehouse } from "./warehouse";
import { dropdownId, isUuid } from "./shipment-create";
import type { MasterOptions, UserRequest, UserRow, WarehouseRequest } from "@/types/api";

/**
 * User Management <-> the backend's user endpoints (local Swagger, 2026-11-10):
 *
 *   GET  /users          all users                 -> fromUserRow
 *   GET  /users/{id}     one user, with warehouses -> fromUserRow / fromUserWarehouses
 *   POST /users/createUser   new user                  <- toUserRequest
 *   PUT  /users/updateUser     edit (id in the body)     <- toUserRequest
 *
 * Countries and PODs are sent as UUIDs: the country from GET /users/countryDropdown (`userCountries`), the
 * POD from podDropdown (`ports`, the list the shipment form also uses). A value with no match is left out,
 * never guessed.
 */

const ROLE_FROM_API: Record<string, string> = {
  OWNER: "Admin",
  ACCOUNTANT: "Accountant",
  RECEIVER: "Receiver",
  SHIPPER: "Shipper",
  CHA: "CHA",
};
const ROLE_TO_API: Record<string, string> = Object.fromEntries(
  Object.entries(ROLE_FROM_API).map(([api, ui]) => [ui, api]),
);

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Roles whose accounts belong to a company (they show the Entity Code field). */
export const hasEntityCode = (role: string) =>
  role === "Shipper" || role === "Receiver" || role === "CHA";

/** The entity code a new member gets when none is typed: "Jeeva R" -> "JEEVAR". */
export const entityCodeFromName = (name: string) =>
  name.replace(/[^\p{L}\p{M}\p{N}]/gu, "").toUpperCase();

/**
 * The country list a user's `countryId` belongs to: GET /users/countryDropdown (`userCountries`). Only if
 * that list has not loaded, the POL list (`countries`) the app used before is tried.
 */
export const userCountryList = (options: MasterOptions | undefined) =>
  options?.["userCountries"]?.length ? "userCountries" : "countries";

/** A country's code for display: the row's own code, else the code of its countryId in the list. */
function countryOf(row: UserRow, options: MasterOptions | undefined): string {
  const own = text(row.countryCode) || text(row.country);
  if (own) return own;
  const hit = options?.[userCountryList(options)]?.find((c) => c.id === text(row.countryId));
  return hit?.code ?? hit?.name ?? "";
}

/** The code of a CHA's first POD, from `portIds` (UUIDs) and the POD list. */
function podOf(row: UserRow, options: MasterOptions | undefined): string {
  const ids = Array.isArray(row.portIds) ? row.portIds.map(String) : [];
  const hit = options?.["ports"]?.find((p) => ids.includes(p.id));
  return hit?.code ?? hit?.name ?? "";
}

/** Warehouses inside a user reply -> the warehouse cards. Inactive ones are left out. */
export function fromUserWarehouses(list: unknown): Warehouse[] {
  if (!Array.isArray(list)) return [];
  return (list as Partial<WarehouseRequest>[])
    .filter((w) => w && w.active !== false)
    .map((w) => {
      const id = text(w.id);
      return {
        ...newWarehouse(),
        ...(id ? { id, serverId: id } : {}),
        name: text(w.name),
        location: text(w.location),
        whatsapp: text(w.whatsappNumber),
        ...(text(w.whatsappOptedInOn) ? { optedInOn: text(w.whatsappOptedInOn) } : {}),
      };
    });
}

/** A GET /users (or /users/{id}) item -> the member shape User Management shows. No password is ever read. */
export function fromUserRow(row: UserRow, options?: MasterOptions): User {
  const username = text(row.username);
  const role = ROLE_FROM_API[text(row.role).toUpperCase()] ?? text(row.role);
  const warehouses = fromUserWarehouses(row.warehouses);
  const port = role === "CHA" ? podOf(row, options) || text(row.location) : text(row.location);
  return {
    name: text(row.fullName) || text(row.displayName) || username,
    username,
    short: text(row.displayName),
    role,
    country: countryOf(row, options),
    port,
    status: row.active === false ? "Inactive" : "Active",
    password: "",
    ...(row.id !== undefined && row.id !== null && row.id !== "" ? { serverId: row.id } : {}),
    ...(text(row.email) ? { email: text(row.email) } : {}),
    ...(text(row.linkedCode) || text(row.entityCode)
      ? { linked: text(row.linkedCode) || text(row.entityCode) }
      : {}),
    ...(warehouses.length ? { warehouses } : {}),
    ...(row.partyId !== undefined ? { partyId: row.partyId } : {}),
    ...(row.shipperId !== undefined ? { shipperId: row.shipperId } : {}),
    ...(row.chaId !== undefined ? { chaId: row.chaId } : {}),
  };
}

/** One warehouse card -> its part of the user request. The number is sent with the country code. */
export function toWarehouseRequest(w: Warehouse): WarehouseRequest {
  return {
    ...(isUuid(w.serverId) ? { id: w.serverId } : {}),
    name: w.name.trim(),
    ...(w.location.trim() ? { location: w.location.trim() } : {}),
    ...(w.whatsapp.trim() ? { whatsappNumber: fullWhatsapp(w.whatsapp.trim()) } : {}),
    ...(w.optedInOn ? { whatsappOptedInOn: w.optedInOn } : {}),
    active: true,
  };
}

/**
 * A member -> the POST /users/createUser or PUT /users/updateUser body. Empty values are left out; the password is
 * sent only when one was typed. Receivers send their warehouses, a CHA sends their POD as `portIds`.
 */
export function toUserRequest(u: User, password: string, options?: MasterOptions): UserRequest {
  const location = u.port && u.port !== "—" ? u.port.trim() : "";
  const podId = u.role === "CHA" ? dropdownId(options, "ports", location) : undefined;
  const warehouses = (u.warehouses ?? []).filter((w) => w.name.trim()).map(toWarehouseRequest);
  // `code` (<=20): the entity code for a company role (typed, or derived from the name), otherwise the
  // username. It is always sent, so every member has a short code on the server.
  const entityCode = hasEntityCode(u.role) ? u.linked?.trim() || entityCodeFromName(u.name) : "";
  const code = (entityCode || u.username.trim()).slice(0, 20);
  const body: Record<string, unknown> = {
    ...(isUuid(u.serverId) ? { id: u.serverId } : {}),
    username: u.username.trim(),
    code: code || undefined,
    displayName: u.short.trim(),
    fullName: u.name.trim(),
    email: u.email?.trim(),
    password: password || undefined,
    role: ROLE_TO_API[u.role] ?? u.role,
    countryId: dropdownId(options, userCountryList(options), u.country),
    location: location || undefined,
    active: (u.status || "Active") !== "Inactive",
    warehouses: u.role === "Receiver" && warehouses.length ? warehouses : undefined,
    portIds: podId ? [podId] : undefined,
  };
  return Object.fromEntries(
    Object.entries(body).filter(([, v]) => v !== undefined && v !== ""),
  ) as UserRequest;
}
