import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@/lib/fsc";
import { portChaChoices, type ChaChoice } from "@/lib/master-choices";
import { receiverUserId, warehousesForReceiver } from "@/lib/receiver-warehouses";
import type { Warehouse } from "@/lib/warehouse";
import type { MasterOptions, PortCha } from "@/types/api";

/** User Management members, used to find the warehouses of a shipment's receiver. */
export const ReceiverDirectoryContext = createContext<User[]>([]);
export const useReceiverDirectory = () => useContext(ReceiverDirectoryContext);

/** Master data from GET /api/masters/options (undefined until it has loaded). */
export const MasterOptionsContext = createContext<MasterOptions | undefined>(undefined);
export const useMasterOptions = () => useContext(MasterOptionsContext);

/** Names from GET /products; empty until they have loaded. */
export const ProductNamesContext = createContext<string[]>([]);

/** Reads a receiver user's warehouses from GET /users/getUserById. Absent outside the signed-in app. */
export type WarehouseLoader = (
  userId: string | number,
) => Promise<{ list: Warehouse[] } | { error: string }>;
export const WarehouseLoaderContext = createContext<WarehouseLoader | undefined>(undefined);

const NONE: Warehouse[] = [];

/** Reads a POD's CHAs from GET /ports/{portCode}/chas. Absent outside the signed-in app. */
export type PortChaLoader = (portCode: string) => Promise<{ rows: PortCha[] } | { error: string }>;
export const PortChaLoaderContext = createContext<PortChaLoader | undefined>(undefined);

/** The CHAs of the chosen POD. Reloads when the POD changes; `active` is false with no loader or no POD. */
export function usePortChas(portCode: string | undefined) {
  const load = useContext(PortChaLoaderContext);
  const code = (portCode ?? "").trim();
  const [result, setResult] = useState<{
    code: string;
    choices?: ChaChoice[];
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!load || !code) return;
    // Only the latest POD's answer counts: an earlier one can arrive after it.
    let latest = true;
    void load(code).then((reply) => {
      if (!latest) return;
      setResult(
        "error" in reply
          ? { code, error: reply.error }
          : { code, choices: portChaChoices(reply.rows) },
      );
    });
    return () => {
      latest = false;
    };
  }, [load, code]);
  const active = Boolean(load && code);
  const settled = active && result?.code === code ? result : null;
  return {
    active,
    loading: active && !settled,
    choices: settled?.choices ?? [],
    error: settled?.error,
  };
}

/**
 * The warehouses a shipment's receiver can deliver to: from the server when the receiver is in the master
 * data, otherwise those entered in User Management. Reloads when the receiver changes.
 */
export function useReceiverWarehouses(receiver: string | undefined) {
  const master = useMasterOptions();
  const directory = useReceiverDirectory();
  const load = useContext(WarehouseLoaderContext);
  // The receiver's user, whose warehouses GET /users/getUserById returns.
  const userId = receiverUserId(directory, receiver, master);
  const userKey = userId === undefined ? "" : String(userId);
  const local = useMemo(
    () => warehousesForReceiver(directory, receiver, master),
    [directory, receiver, master],
  );
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    userKey: string;
    attempt: number;
    list?: Warehouse[];
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!load || userId === undefined) return;
    // Only the latest receiver's answer counts: an earlier one can arrive after it.
    let latest = true;
    void load(userId).then((reply) => {
      if (latest) setResult({ userKey, attempt, ...reply });
    });
    return () => {
      latest = false;
    };
  }, [load, userId, userKey, attempt]);
  const fromServer = load !== undefined && userId !== undefined;
  const settled = fromServer && result?.userKey === userKey && result.attempt === attempt;
  return {
    list: fromServer ? (settled ? (result.list ?? NONE) : NONE) : local,
    fromServer,
    loading: fromServer && !settled,
    error: settled ? result.error : undefined,
    retry: () => setAttempt((a) => a + 1),
  };
}
