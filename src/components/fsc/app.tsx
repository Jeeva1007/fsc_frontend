import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  CloudSun,
  ChevronRight,
  CircleHelp,
  FileCheck2,
  Globe2,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  PanelLeftClose,
  Plus,
  Settings2,
  ShieldCheck,
  History,
  Users,
  Pencil,
} from "lucide-react";
import { snackbar } from "@/components/ui/snackbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Dashboard } from "./dashboard";
import { ShipmentForm } from "./shipment-form";
import { approvedShipment, pendingSamples } from "@/lib/pending-shipments";
import {
  ShipmentsTable,
  ShipmentDetail,
  ShipmentPayments,
  RoleShipmentsTable,
  type Payment,
  type ServerFilter,
} from "./shipments";
import { Ledger } from "./ledger";
import { AccountantLedger } from "./accountant-ledger";
import { fromGsmOxLedgerResponse } from "@/lib/debit-advice-api";
import type { DebitAdvice } from "@/lib/debit-advice";
import { Login } from "./login";
import { ChaScreen, Meeting, Settings, UserManagement } from "./other-screens";
import { useWorkspace } from "@/lib/fsc-workspace";
import { useAppDispatch } from "@/store/hooks";
import { loggedOut } from "@/store/slices/authSlice";
import {
  authApi,
  baseApi,
  useCreateShipmentRequestMutation,
  useLazyShipmentSummaryQuery,
  useUpdateShipmentRequestMutation,
  useUpdateShipmentStageMutation,
  useLazyChaDropdownQuery,
  useShipmentListQuery,
  useShipmentDropdownsQuery,
  useWorkflowStagesQuery,
  useListPaymentsQuery,
  useAddPaymentMutation,
  useUpdatePaymentMutation,
  useReversePaymentMutation,
  usePaymentSummaryQuery,
  useChangePasswordMutation,
  useCreateUserMutation,
  useListUsersQuery,
  useListLedgersQuery,
  useUpdateChecksMutation,
  useUpdateShipmentMutation,
  useUpdateStageMutation,
  useUpdateUserMutation,
  useLazyGetUserQuery,
  useLoginMutation,
  useLogoutMutation,
  useMeQuery,
} from "@/store/api";
import { sessionFromMe } from "@/lib/auth-session";
import { clearStoredMe, writeStoredMe } from "@/lib/session-store";
import { activeShipments, deliveredShipments } from "@/lib/listing";
import { shipmentListRows } from "@/lib/shipment-list";
import { planIsEmpty, planShipmentSync } from "@/lib/shipment-sync";
import { fromUserRow, fromUserWarehouses, toUserRequest } from "@/lib/users-api";
import { describeApiError, toShipmentPayload } from "@/lib/shipment-api";
import {
  checkboxStageUpdates,
  dropdownId,
  stageId,
  toCreateShipmentRequest,
  toUpdateShipmentRequest,
} from "@/lib/shipment-create";
import type { ShipmentListArgs, UserListArgs } from "@/types/api";
import {
  LEDGER_SEARCH_MAX,
  LEDGER_SEARCH_MIN,
  type LedgerServerPage,
  type ServerPage,
} from "@/lib/page";
import {
  extractPaymentRecords,
  fromPaymentRecord,
  serverPaymentId,
  toPaymentBody,
  toPaymentSide,
  visiblePayments,
} from "@/lib/payments-api";
import {
  fromShipmentPaymentResponse,
  toShipmentPaymentUpdateItem,
  buildShipmentTpt,
} from "@/lib/shipment-payments";
import { SearchInput, TextField } from "./fields";
import { ChangePassword } from "./change-password";
import {
  access,
  canAccess,
  roleFor,
  titles,
  type Screen,
  type Shipment,
  type User,
} from "@/lib/fsc";
import { initialLedgerEntries, latestTransferAmount } from "@/lib/fsc-finance";
import { AuditLogs } from "./audit-logs";
import { BrandLogo } from "./brand-logo";
import {
  MasterOptionsContext,
  ReceiverDirectoryContext,
  WarehouseLoaderContext,
  PortChaLoaderContext,
  ProductNamesContext,
} from "./receiver-directory";
const icons = {
  dashboard: LayoutDashboard,
  shipments: Package,
  master: Globe2,
  ledger: BookOpen,
  meeting: MessageSquare,
  users: Users,
  audit: History,
  settings: Settings2,
  cha: FileCheck2,
};
const descriptions: Record<Screen, string> = {
  dashboard: "Your supply chain, at a glance.",
  shipments: "Track, manage and move your shipments forward.",
  master: "All shipments and complete payment records.",
  ledger: "A clear view of every charge, payment and transfer.",
  meeting: "Keep your team connected and operations aligned.",
  users: "Manage the people in your workspace.",
  audit: "Track who changed what across your workspace, and when.",
  settings: "Manage your workspace preferences.",
  cha: "Clearance assignments and shipment documents.",
};
const paths = {
  dashboard: "/",
  shipments: "/shipments",
  master: "/master-records",
  ledger: "/ledger",
  meeting: "/meeting",
  users: "/user-management",
  audit: "/audit-logs",
  settings: "/settings",
  cha: "/cha-user",
} as const;
export function FscApp({ screen }: { screen: Screen }) {
  const navigate = useNavigate();
  const { preferences } = useWorkspace();
  const dispatch = useAppDispatch();
  const [loginRequest] = useLoginMutation();
  const [logoutRequest] = useLogoutMutation();
  // The server session (cookie) is the only source of who is signed in and with which role.
  const { data: me, isLoading: meLoading } = useMeQuery();
  const apiUser = sessionFromMe(me);
  // A new or reset account must choose a new password before anything else is loaded or shown.
  const mustChangePassword = Boolean(apiUser) && me?.mustChangePassword === true;
  const ready = Boolean(apiUser) && !mustChangePassword;
  // GET /listing and /masters/options are not called (user request, 2026-11-10): the shipment tables start
  // empty. The shipment dropdowns come from the local backend's /shipments/*Dropdown lists (UUID ids), its
  // stages turn a status into workflowStageId, and its productDropdown feeds the Product fields; a list that
  // fails leaves that dropdown on its built-in values.
  const { data: masterOptions } = useShipmentDropdownsQuery(undefined, { skip: !ready });
  const { data: workflowStages } = useWorkflowStagesQuery(undefined, { skip: !ready });
  // GET /shipments/shipmentList fills the shipment tables. Rows the server does not know yet (a shipment
  // just added on screen but not saved) are kept; a server row replaces the local copy of the same shipment.
  // The unfiltered set feeding `master` (Master tab + ledger/dashboard/directory/role tables). 100 is the
  // backend's max page size; the Active list has its own size-10 paginated query below.
  const { data: shipmentRows, refetch: refetchShipmentRows } = useShipmentListQuery(
    { size: 100 },
    { skip: !ready },
  );
  // Product names for the Product fields, derived from the productDropdown list loaded into masterOptions.
  const products = useMemo(
    () => [
      ...new Set(
        (masterOptions?.["products"] ?? [])
          .map((o) => (o.name ?? o.code ?? "").trim())
          .filter(Boolean),
      ),
    ],
    [masterOptions],
  );
  const [createShipment] = useCreateShipmentRequestMutation();
  const [chaDropdownRequest] = useLazyChaDropdownQuery();
  const [saveShipmentEdit] = useUpdateShipmentRequestMutation();
  const [saveShipmentStage] = useUpdateShipmentStageMutation();
  const [loadShipmentSummary] = useLazyShipmentSummaryQuery();
  const [addPaymentRequest] = useAddPaymentMutation();
  const [updatePaymentRequest] = useUpdatePaymentMutation();
  const [reversePaymentRequest] = useReversePaymentMutation();
  const [changePasswordRequest] = useChangePasswordMutation();
  const [updateShipmentRequest] = useUpdateShipmentMutation();
  const [updateChecksRequest] = useUpdateChecksMutation();
  const [updateStageRequest] = useUpdateStageMutation();
  const [createUserRequest] = useCreateUserMutation();
  const [updateUserRequest] = useUpdateUserMutation();
  const [getUserRequest] = useLazyGetUserQuery();
  // Only the owner can manage members, so the list is not requested for anyone else. This unfiltered,
  // larger fetch feeds the receiver directory and Audit screen; the User Management table uses its own
  // paginated query (userPage) below.
  const { data: userRows } = useListUsersQuery(
    { size: 100 }, // 100 is the backend's max page size
    { skip: !ready || apiUser?.role !== "Admin" },
  );
  const [users, setUsers] = useState<User[]>([]);
  const [weather, setWeather] = useState({ temp: "94.93", high: "100" });
  const [weatherEdit, setWeatherEdit] = useState(false);
  // Only rendered while signed in; the fallback is never admin.
  const current = apiUser ?? {
    name: "",
    username: "",
    short: "",
    role: "Receiver",
    country: "—",
    port: "—",
    password: "",
  };
  const role = roleFor(current.role);
  const [collapsed, setCollapsed] = useState(false);
  const [account, setAccount] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  // Close the profile menu on any click outside it, or on Escape.
  useEffect(() => {
    if (!account) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!profileRef.current?.contains(e.target as Node)) setAccount(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccount(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [account]);
  const [notifications, setNotifications] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  // Close the notifications panel on any click outside it and the bell, or on Escape.
  useEffect(() => {
    if (!notifications) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!bellRef.current?.contains(target) && !notificationsRef.current?.contains(target))
        setNotifications(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotifications(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [notifications]);
  const [notices, setNotices] = useState(true);
  // One list: the Master tab shows all of it, and the Active tab all but Delivered, so a status change moves a row.
  const [master, setMaster] = useState<Shipment[]>([]);
  const active = useMemo(() => activeShipments(master), [master]);
  const delivered = useMemo(() => deliveredShipments(master), [master]);
  const [selected, setSelected] = useState<Shipment | null>(null);
  // Bumped by each Ledger menu click: the ledger remounts on its first tab, even when already open (user
  // request, 2026-11-16). Only a page refresh brings back the tab that was open (see stored-view.ts).
  const [ledgerVisit, setLedgerVisit] = useState(0);
  // Mirrors GET /shipments/shipmentList into the tables. The server rows are the source of truth; any row
  // still only on screen (no serverUuid, and no server row for the same container) is kept so nothing the
  // user just added disappears before it is saved.
  useEffect(() => {
    const rows = shipmentRows?.items;
    if (!Array.isArray(rows)) return;
    const mapped = shipmentListRows(rows, masterOptions, workflowStages);
    const containers = new Set(mapped.map((r) => r.vase).filter(Boolean));
    setMaster((prev) => {
      const localOnly = prev.filter((r) => !r.serverUuid && !(r.vase && containers.has(r.vase)));
      return [...mapped, ...localOnly];
    });
  }, [shipmentRows, masterOptions, workflowStages]);
  // Opening a shipment the server knows refreshes its summary from GET /shipments/{id}: the file number and
  // the AGV amount the server worked out. The container number is the row's key, so it is not replaced.
  const openedUuid = selected?.serverUuid;
  useEffect(() => {
    if (!openedUuid) return;
    let latest = true;
    void loadShipmentSummary(openedUuid).then(({ data }) => {
      if (!latest || !data) return;
      const refresh = (row: Shipment): Shipment =>
        row.serverUuid !== openedUuid
          ? row
          : {
              ...row,
              ...(data.fileNo ? { dos: data.fileNo } : {}),
              ...(typeof data.agvAmount === "number" ? { agv: data.agvAmount.toFixed(2) } : {}),
            };
      setMaster((rows) => rows.map(refresh));
      setSelected((row) => (row ? refresh(row) : row));
    });
    return () => {
      latest = false;
    };
  }, [openedUuid, loadShipmentSummary]);
  const [selectedMaster, setSelectedMaster] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState(initialLedgerEntries);
  // The Debit Advice register comes entirely from GET /gsmOxLedger/ledgerList now; no hardcoded rows.
  const [debitAdvices, setDebitAdvices] = useState<DebitAdvice[]>([]);
  // GET /gsmOxLedger/ledgerList fills the GSM-OX Deal Ledger / Debit Advice register (owner + accountant
  // only), server-paginated: the footer drives the backend `page`, and only the current page is held.
  const [ledgerUiPage, setLedgerUiPage] = useState(1);
  // The register's Party filter is sent as ledgerList `party` (Party Name), so it covers every page.
  const [ledgerParty, setLedgerParty] = useState("");
  // Search, BE closure and payment status also go to the server (user request, 2026-11-16), so they cover
  // every page instead of only the 10 rows on screen.
  const [ledgerClosure, setLedgerClosure] = useState("");
  const [ledgerStatus, setLedgerStatus] = useState("");
  // The search box as typed; sent 300 ms after typing stops, and only at 2 to 50 characters (ledgerList
  // rejects other lengths). One character searches nothing yet, so the list stays as it was.
  const [ledgerSearchText, setLedgerSearchText] = useState("");
  const [ledgerSearch, setLedgerSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => {
      const t = ledgerSearchText.trim();
      const next = t.length >= LEDGER_SEARCH_MIN ? t.slice(0, LEDGER_SEARCH_MAX) : "";
      setLedgerSearch(next);
    }, 300);
    return () => clearTimeout(id);
  }, [ledgerSearchText]);
  // A new search starts the register over at page 1.
  useEffect(() => setLedgerUiPage(1), [ledgerSearch]);
  const { data: ledgerRows } = useListLedgersQuery(
    {
      page: ledgerUiPage - 1,
      size: 10,
      ...(ledgerSearch ? { search: ledgerSearch } : {}),
      ...(ledgerParty ? { party: ledgerParty } : {}),
      ...(ledgerClosure ? { beClosureStatus: ledgerClosure } : {}),
      ...(ledgerStatus ? { paymentStatus: ledgerStatus } : {}),
    },
    { skip: !ready || !(apiUser?.role === "Admin" || apiUser?.role === "Accountant") },
  );
  useEffect(() => {
    const rows = ledgerRows?.items;
    if (!Array.isArray(rows)) return;
    setDebitAdvices(rows.map(fromGsmOxLedgerResponse));
  }, [ledgerRows]);
  const ledgerServerPage = useMemo<LedgerServerPage>(
    () => ({
      page: ledgerUiPage,
      size: 10,
      total: ledgerRows?.total ?? 0,
      onPage: setLedgerUiPage,
      search: ledgerSearchText,
      onSearch: (v: string) => setLedgerSearchText(v.slice(0, LEDGER_SEARCH_MAX)),
      party: ledgerParty,
      onParty: (p: string) => {
        setLedgerParty(p);
        setLedgerUiPage(1);
      },
      closure: ledgerClosure,
      onClosure: (v: string) => {
        setLedgerClosure(v);
        setLedgerUiPage(1);
      },
      paymentStatus: ledgerStatus,
      onPaymentStatus: (v: string) => {
        setLedgerStatus(v);
        setLedgerUiPage(1);
      },
    }),
    [ledgerUiPage, ledgerRows, ledgerSearchText, ledgerParty, ledgerClosure, ledgerStatus],
  );
  const [editing, setEditing] = useState<Shipment | null>(null);
  const [add, setAdd] = useState(false);
  const [search, setSearch] = useState("");
  // The Shipments list filters search/receiver/status on the server via GET /shipments/shipmentList.
  // The search box is typed quickly, so it is debounced before it becomes a request.
  const [shipStatus, setShipStatus] = useState("");
  const [shipReceiver, setShipReceiver] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [shipUiPage, setShipUiPage] = useState(1);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);
  // A changed filter starts the page over.
  useEffect(() => setShipUiPage(1), [debouncedSearch, shipReceiver, shipStatus]);
  // Search -> `search`, receiver code -> `receiverId` (its dropdown UUID), status -> `stage` (its workflow
  // stage number). A value that cannot be resolved is left out, so the server simply does not narrow by it.
  // The Shipments list is server-paginated at size 10; the footer drives the backend `page`.
  const shipmentFilterArgs = useMemo<ShipmentListArgs>(() => {
    const receiverId = dropdownId(masterOptions, "parties", shipReceiver);
    const stage = stageId(workflowStages, shipStatus);
    return {
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(receiverId ? { receiverId } : {}),
      ...(stage !== undefined ? { stage } : {}),
      page: shipUiPage - 1,
      size: 10,
    };
  }, [debouncedSearch, shipReceiver, shipStatus, shipUiPage, masterOptions, workflowStages]);
  const { data: shipPage, refetch: refetchShipPage } = useShipmentListQuery(shipmentFilterArgs, {
    skip: !ready,
  });
  /**
   * Calls GET /shipments/shipmentList again for both lists (the master list and the Active page with its
   * filters) after a shipment is created, edited or moved to another stage, so every screen shows what the
   * server now holds. RTK skips a call for a list that is already being fetched, so this never doubles up
   * with the refetch the save's cache invalidation starts. Skipped while signed out (nothing to refetch).
   */
  const reloadShipments = () => {
    if (!ready) return;
    void refetchShipmentRows();
    void refetchShipPage();
  };
  const activeRows = useMemo(
    () => shipmentListRows(shipPage?.items ?? [], masterOptions, workflowStages),
    [shipPage, masterOptions, workflowStages],
  );
  const shipmentServerPage = useMemo<ServerPage>(
    () => ({ page: shipUiPage, size: 10, total: shipPage?.total ?? 0, onPage: setShipUiPage }),
    [shipUiPage, shipPage],
  );
  // Every receiver to offer in the filter, taken from the full list so the choices never shrink.
  const allReceivers = useMemo(
    () => [...new Set(master.map((row) => row.rcv).filter(Boolean))],
    [master],
  );
  // Memoised so its identity changes only when a filter value does, keeping the table's paging stable.
  const shipmentServerFilter = useMemo<ServerFilter>(
    () => ({
      search,
      onSearch: setSearch,
      status: shipStatus,
      onStatus: setShipStatus,
      receiver: shipReceiver,
      onReceiver: setShipReceiver,
      receivers: allReceivers,
    }),
    [search, shipStatus, shipReceiver, allReceivers],
  );
  const [payments, setPayments] = useState<Record<string, Payment[]>>({});
  const [pending, setPending] = useState(pendingSamples);
  // Payments of the open shipment (or the one in the table's Edit pop-up) come from
  // GET /shipments/{id}/payments (reversed ones are hidden).
  const paymentTarget = editing ?? selected;
  const selectedServerId = paymentTarget?.serverId;
  const shipmentUuid = paymentTarget?.serverUuid;
  const selectedVase = paymentTarget?.vase;
  // Local backend: GET /shipmentPayments/paymentSummary gives the rows + AGV/totals + TPT balance.
  const { data: paySummary } = usePaymentSummaryQuery(shipmentUuid ?? "", {
    skip: !ready || !shipmentUuid,
  });
  // Saved-row ids removed on screen, per shipment vase, sent in updateShipment's deletedPaymentIds.
  const [deletedPaymentIds, setDeletedPaymentIds] = useState<Record<string, string[]>>({});
  // Whoever the summary gives TPT figures to is the TPT owner; a non-owner gets nulls and never sends `tpt`.
  const ownsTpt =
    paySummary?.availableTptBalance !== null && paySummary?.availableTptBalance !== undefined;
  useEffect(() => {
    if (!paySummary || !selectedVase) return;
    // The summary hides the TPT row from the payments table (it lives in the `tpt` block, not the grid).
    const rows = (paySummary.payments ?? [])
      .filter((p) => p.gsmTptType !== "TPT")
      .map(fromShipmentPaymentResponse);
    setPayments((ps) => ({ ...ps, [selectedVase]: rows }));
    // Fresh server state: nothing is pending deletion for this file.
    setDeletedPaymentIds((d) => (d[selectedVase] ? { ...d, [selectedVase]: [] } : d));
    // Preselect the TPT radio from the server's reservation: full when no partial amount was used.
    const tptUsed = paySummary.tptUsed ?? 0;
    const preMode: "full" | "partial" | undefined =
      tptUsed > 0 ? ((paySummary.tptAmountForFull ?? 0) === 0 ? "full" : "partial") : undefined;
    if (preMode) {
      const tptRow = (paySummary.payments ?? []).find((p) => p.gsmTptType === "TPT");
      const prePartial = preMode === "partial" ? String(tptRow?.gsmTpt ?? "") : "";
      // Only set it when the form has no choice yet, so a choice in progress is never overwritten.
      const preselect = (s: Shipment): Shipment =>
        s.vase === selectedVase && s.tptMode === undefined
          ? { ...s, tptMode: preMode, tptPartial: prePartial }
          : s;
      setEditing((s) => (s ? preselect(s) : s));
      setSelected((s) => (s ? preselect(s) : s));
    }
  }, [paySummary, selectedVase]);
  // Deployed backend fallback: GET /shipments/{id}/payments (skipped once the local UUID flow is in use).
  const { data: paymentSection } = useListPaymentsQuery(selectedServerId ?? 0, {
    skip: !ready || selectedServerId === undefined || shipmentUuid !== undefined,
  });
  useEffect(() => {
    if (!paymentSection || !selectedVase || shipmentUuid) return;
    const rows = visiblePayments(extractPaymentRecords(paymentSection)).map(fromPaymentRecord);
    setPayments((ps) => ({ ...ps, [selectedVase]: rows }));
  }, [paymentSection, selectedVase, shipmentUuid]);
  // On a local shipment, ticking a row or deleting one changes local state only; everything is saved in one
  // updateShipment call from "Save Changes". A saved row removed on screen is remembered for deletedPaymentIds.
  const recordDeletedPayment = (p: Payment) => {
    if (!selectedVase || !p.serverSaved) return;
    setDeletedPaymentIds((d) => {
      const existing = d[selectedVase] ?? [];
      return existing.includes(p.id) ? d : { ...d, [selectedVase]: [...existing, p.id] };
    });
  };
  // Deployed-backend fallback (numeric id). Used only when there is no local UUID.
  const deployedPaymentActions =
    selectedServerId === undefined
      ? undefined
      : {
          save: async (p: Payment, existing: Payment[]): Promise<string | null> => {
            try {
              const known = serverPaymentId(p);
              if (known !== undefined && existing.some((x) => x.id === p.id)) {
                await updatePaymentRequest({
                  shipmentId: selectedServerId,
                  paymentId: known,
                  body: toPaymentSide(p),
                }).unwrap();
              } else {
                await addPaymentRequest({
                  shipmentId: selectedServerId,
                  body: toPaymentBody(p, existing.length),
                }).unwrap();
              }
              return null;
            } catch (error) {
              return describeApiError(error);
            }
          },
          remove: async (p: Payment): Promise<string | null> => {
            const known = serverPaymentId(p);
            if (known === undefined) return null; // never reached the server
            try {
              await reversePaymentRequest({
                shipmentId: selectedServerId,
                paymentId: known,
              }).unwrap();
              return null;
            } catch (error) {
              return describeApiError(error);
            }
          },
        };
  // Local shipments (serverUuid) save payments through updateShipment, so no per-row actions are passed:
  // the component keeps edits local. The deployed fallback (numeric serverId) still saves each row.
  const paymentActions = shipmentUuid !== undefined ? undefined : deployedPaymentActions;
  // Mirrors GET /users into User Management. GET /users has no warehouse data, so warehouses entered on
  // this screen are carried over by username when the list refreshes.
  useEffect(() => {
    // A reply that is not a page (an unknown backend shape) must not take the whole app down.
    const rows = userRows?.items;
    if (!Array.isArray(rows)) return;
    setUsers((prev) => {
      const kept = new Map(prev.map((u) => [u.username, u.warehouses]));
      return rows.map((row) => {
        // The country and POD lists turn the row's UUIDs back into the codes the screen shows.
        const member = fromUserRow(row, masterOptions);
        const warehouses = member.warehouses?.length
          ? member.warehouses
          : kept.get(member.username);
        return warehouses?.length ? { ...member, warehouses } : member;
      });
    });
  }, [userRows, masterOptions]);
  // User Management filters search/role/status on the server via GET /users/usersList, like the Shipments
  // list. The unfiltered `users` above still feeds the receiver directory and Audit screen, so filtering
  // here never shrinks those. Search is debounced; the backend ignores a term under 2 characters.
  const [userSearch, setUserSearch] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userStatus, setUserStatus] = useState("");
  const [debouncedUserSearch, setDebouncedUserSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedUserSearch(userSearch.trim()), 300);
    return () => clearTimeout(id);
  }, [userSearch]);
  const [userUiPage, setUserUiPage] = useState(1);
  // A changed filter starts the page over.
  useEffect(() => setUserUiPage(1), [debouncedUserSearch, userRole, userStatus]);
  const userListArgs = useMemo<UserListArgs>(() => {
    // The screen shows display roles; the API wants role codes.
    const roleCode: Record<string, string> = {
      Admin: "OWNER",
      Accountant: "ACCOUNTANT",
      Receiver: "RECEIVER",
      Shipper: "SHIPPER",
      CHA: "CHA",
    };
    return {
      ...(debouncedUserSearch.length >= 2 ? { search: debouncedUserSearch } : {}),
      ...(userRole ? { role: roleCode[userRole] ?? userRole } : {}),
      ...(userStatus ? { status: userStatus.toLowerCase() } : {}),
      page: userUiPage - 1,
      size: 10,
    };
  }, [debouncedUserSearch, userRole, userStatus, userUiPage]);
  // The User Management table always reads this paginated query (filters + current page).
  const { data: userPage } = useListUsersQuery(userListArgs, {
    skip: !ready || apiUser?.role !== "Admin",
  });
  const userListRows = useMemo(() => {
    const rows = userPage?.items;
    if (!Array.isArray(rows)) return [];
    const kept = new Map(users.map((u) => [u.username, u.warehouses]));
    return rows.map((row) => {
      const member = fromUserRow(row, masterOptions);
      const warehouses = member.warehouses?.length ? member.warehouses : kept.get(member.username);
      return warehouses?.length ? { ...member, warehouses } : member;
    });
  }, [userPage, users, masterOptions]);
  const userServerFilter = useMemo(
    () => ({
      search: userSearch,
      onSearch: setUserSearch,
      role: userRole,
      onRole: setUserRole,
      status: userStatus,
      onStatus: setUserStatus,
    }),
    [userSearch, userRole, userStatus],
  );
  const userServerPage = useMemo<ServerPage>(
    () => ({ page: userUiPage, size: 10, total: userPage?.total ?? 0, onPage: setUserUiPage }),
    [userUiPage, userPage],
  );
  /**
   * Saves a member: POST /users/createUser for a new one, PUT /users/updateUser (with their id) for an edit.
   * A Receiver's warehouses travel inside the same request. Resolves to an error message, or null when saved.
   */
  const saveUser = async (member: User, password: string, original: string) => {
    const body = toUserRequest(member, password, masterOptions);
    if (original && member.serverId === undefined)
      return "This member has not been loaded from the server yet.";
    const result = original
      ? await updateUserRequest({ ...body, id: String(member.serverId) })
      : await createUserRequest(body);
    return "error" in result ? describeApiError(result.error) : null;
  };
  // Reads a receiver's warehouses from GET /users/getUserById (the warehouses are nested on the user), so
  // choosing a Receiver in the Add Shipment form binds that user's warehouses.
  const loadReceiverWarehouses = useCallback(
    async (userId: string | number) => {
      const result = await getUserRequest(userId);
      if (result.error) return { error: describeApiError(result.error) };
      return { list: fromUserWarehouses(result.data?.warehouses) };
    },
    [getUserRequest],
  );
  // Reads a POD's CHAs through GET /ports/{portCode}/chas.
  // The CHAs of a POD: GET /shipments/chaDropdown?portId=<the POD's UUID>. The form stores the POD's code,
  // so it is looked up in the POD list first; each CHA keeps its UUID for createShipment.
  const listPortChas = useCallback(
    async (portCode: string) => {
      const wanted = portCode.trim().toLowerCase();
      const pod = masterOptions?.["ports"]?.find(
        (p) => p.code?.toLowerCase() === wanted || p.name?.toLowerCase() === wanted,
      );
      if (!pod) return { rows: [] };
      const result = await chaDropdownRequest(pod.id);
      if (result.error) return { error: describeApiError(result.error) };
      return {
        rows: (result.data ?? []).map((c) => ({
          chaId: c.id,
          chaCode: c.code ?? null,
          chaName: c.name ?? null,
        })),
      };
    },
    [chaDropdownRequest, masterOptions],
  );
  /**
   * A Receiver's warehouses for the edit pop-up, read from GET /users/{id}. Null for a member the server
   * does not know yet (nothing to load).
   */
  const loadWarehouses = async (member: User) => {
    if (member.serverId === undefined) return null;
    const result = await getUserRequest(member.serverId);
    if (result.error) return { error: describeApiError(result.error) };
    return { list: fromUserWarehouses(result.data?.warehouses) };
  };
  // Preview role switching only: member profiles in memory, never a security boundary.
  const isShipper = current?.role === "Shipper";
  const robTpt = latestTransferAmount(ledgerEntries);
  const displayScreen = canAccess(role, screen) ? screen : "dashboard";
  const go = (next: Screen) => {
    if (next === "ledger") setLedgerVisit((n) => n + 1);
    setSelected(null);
    setSearch("");
    setAccount(false);
    navigate({ to: paths[next] });
  };
  // Saves an edit to the server: PUT /shipments/{id}, /checks and /stage as needed. Rows that are not on
  // the server yet (no serverId) and edits that only touch local data send nothing. Resolves to an error
  // message, or null when there is nothing left unsaved.
  /**
   * Saves an edit of a shipment created on the local backend:
   *   1. PUT /shipments/updateShipment with the whole form, when anything in it changed
   *      (a status change travels in it as workflowStageId);
   *   2. PUT /shipments/updateStage once per document checkbox that was ticked or unticked.
   * Resolves to an error message, or null when everything was saved.
   */
  const syncLocalShipment = async (prev: Shipment, next: Shipment, shipmentId: string) => {
    const problems: string[] = [];
    const body = toUpdateShipmentRequest(next, masterOptions, workflowStages, shipmentId);
    const before = toUpdateShipmentRequest(prev, masterOptions, workflowStages, shipmentId);
    // Payments and the TPT choice ride along in the same updateShipment call (one transaction) when this is
    // the shipment whose Payments section is open. Only ticked (dirty) rows are sent; the owner always sends
    // the TPT choice, a non-owner never does.
    const isPaymentTarget = selectedVase !== undefined && next.vase === selectedVase;
    const paymentItems = isPaymentTarget
      ? (payments[next.vase] ?? []).filter((p) => p.dirty).map(toShipmentPaymentUpdateItem)
      : [];
    const deletedIds = isPaymentTarget ? (deletedPaymentIds[next.vase] ?? []) : [];
    if (paymentItems.length) body.payments = paymentItems;
    if (deletedIds.length) body.deletedPaymentIds = deletedIds;
    if (isPaymentTarget && ownsTpt) body.tpt = buildShipmentTpt(next.tptMode, next.tptPartial);
    const formChanged = JSON.stringify(body) !== JSON.stringify(before);
    if (formChanged) {
      const result = await saveShipmentEdit(body);
      if ("error" in result) problems.push(describeApiError(result.error));
    }
    if (
      next.status !== prev.status &&
      workflowStages &&
      stageId(workflowStages, next.status) === undefined
    )
      problems.push("Status: no matching stage on the server");
    const { updates, missing } = checkboxStageUpdates(prev, next, workflowStages, shipmentId);
    for (const stage of updates) {
      const result = await saveShipmentStage(stage);
      if ("error" in result) problems.push(describeApiError(result.error));
    }
    if (missing.length) problems.push(`${missing.join(", ")}: no matching stage on the server`);
    // Saved or not, read the shipments back from the server.
    if (formChanged || updates.length) reloadShipments();
    if (problems.length) {
      // Nothing was saved (one transaction): keep the on-screen edits so they are not lost.
      const message = `Not saved to server: ${problems.slice(0, 3).join("; ")}`;
      snackbar.error(message);
      return message;
    }
    // Saved: the ticked rows and the removals are now on the server; clear the local pending marks and let the
    // summary refetch bring the fresh rows (new ids) back.
    if (isPaymentTarget && (paymentItems.length || deletedIds.length)) {
      setPayments((ps) => ({
        ...ps,
        [next.vase]: (ps[next.vase] ?? []).map((p) => (p.dirty ? { ...p, dirty: false } : p)),
      }));
      setDeletedPaymentIds((d) => (d[next.vase] ? { ...d, [next.vase]: [] } : d));
      dispatch(baseApi.util.invalidateTags(["Payment"]));
    }
    if (formChanged || updates.length) snackbar.success("Saved to server");
    return null;
  };
  const syncShipment = async (prev: Shipment | undefined, next: Shipment) => {
    if (prev?.serverUuid) return syncLocalShipment(prev, next, prev.serverUuid);
    if (!prev || prev.serverId === undefined) return null;
    const id = prev.serverId;
    const plan = planShipmentSync(prev, { ...next, serverId: id }, masterOptions, undefined);
    if (planIsEmpty(plan)) return null;
    const problems: string[] = [];
    const run = async (call: Promise<{ error?: unknown } | { data: unknown }>) => {
      const result = await call;
      if ("error" in result && result.error) problems.push(describeApiError(result.error));
    };
    if (plan.body) await run(updateShipmentRequest({ id, body: plan.body }));
    if (plan.checks) await run(updateChecksRequest({ id, body: plan.checks }));
    if (plan.stageNo !== undefined) {
      await run(updateStageRequest({ id, body: { stageNo: plan.stageNo } }));
    } else if (plan.stageMissing) {
      problems.push("Status: no matching stage on the server");
    }
    reloadShipments();
    if (problems.length) {
      const message = `Not saved to server: ${problems.slice(0, 3).join("; ")}`;
      snackbar.error(message);
      // Put the screen back to what the server holds.
      dispatch(baseApi.util.invalidateTags(["Shipment"]));
      return message;
    }
    snackbar.success("Saved to server");
    return null;
  };
  const applyEdit = (s: Shipment, original: string) => {
    setMaster((ms) => ms.map((x) => (x.vase === original ? s : x)));
    if (original !== s.vase) setPayments((ps) => ({ ...ps, [s.vase]: ps[original] || [] }));
    if (selected) setSelected(s);
  };
  // A direct stage change from the shipments list calls PUT /shipments/updateStage with the new stage id,
  // rather than re-sending the whole shipment. Only for rows the server knows (serverUuid).
  const changeStageOnly = async (next: Shipment, shipmentId: string) => {
    const workflowStageId = stageId(workflowStages, next.status);
    if (workflowStageId === undefined) {
      snackbar.error("Status: no matching stage on the server");
      dispatch(baseApi.util.invalidateTags(["Shipment"]));
      return;
    }
    const result = await saveShipmentStage({ shipmentId, workflowStageId });
    // Saved or refused, read the shipments back so the row shows the server's stage.
    reloadShipments();
    if ("error" in result) {
      snackbar.error(`Not saved to server: ${describeApiError(result.error)}`);
      dispatch(baseApi.util.invalidateTags(["Shipment"]));
      return;
    }
    snackbar.success("Shipment stage updated");
  };
  // True when only the workflow status differs between two versions of the same shipment.
  const statusOnlyChange = (prev: Shipment, next: Shipment) =>
    prev.status !== next.status &&
    JSON.stringify({ ...prev, status: "" }) === JSON.stringify({ ...next, status: "" });
  // A quick change from a table row: shown at once, and put back by the refetch if the server refuses it.
  const update = (s: Shipment) => {
    const original = selected?.vase || s.vase;
    const prev = master.find((x) => x.vase === original);
    // A stage picked straight from the list goes through updateStage with its stage id.
    if (prev?.serverUuid && statusOnlyChange(prev, s)) {
      void changeStageOnly(s, prev.serverUuid);
      applyEdit(s, original);
      return;
    }
    void syncShipment(prev, s);
    applyEdit(s, original);
  };
  // An edit from the pop-up: the screen changes only after the server accepts it. Resolves to an error
  // message, which keeps the pop-up open with what was typed.
  const saveEdit = async (s: Shipment, original: string) => {
    const problem = await syncShipment(
      master.find((x) => x.vase === original),
      s,
    );
    if (problem) return problem;
    applyEdit(s, original);
    return null;
  };
  const openShipment = (s: Shipment) => {
    setSelected(s);
    setSelectedMaster(displayScreen === "master");
  };
  // Signs in via POST /auth/login; resolves to an error message, or null on success.
  // Set by a successful sign-in; the app then opens the first item of that role's menu.
  const justSignedIn = useRef(false);
  const signIn = async (username: string, password: string) => {
    const result = await loginRequest({ username, password });
    if ("error" in result) {
      const status = (result.error as { status?: unknown }).status;
      if (status === 400 || status === 401) return "Username or Password is incorrect.";
      if (status === 403) return "Sign-in was rejected. Refresh the page and try again.";
      if (status === 429) return "Too many attempts. Please wait and try again.";
      return "Unable to reach the server. Please try again.";
    }
    if (!sessionFromMe(result.data)) return "Username or Password is incorrect.";
    // Open the first menu item once the signed-in role is known (see the effect after navKeys).
    justSignedIn.current = true;
    dispatch(authApi.util.upsertQueryData("me", undefined, result.data));
    writeStoredMe(result.data); // persist so a refresh keeps the session
    return null;
  };
  // POST /auth/password for the forced first-login change; resolves to an error message, or null on success.
  const changePassword = async (currentPassword: string, newPassword: string) => {
    const result = await changePasswordRequest({ currentPassword, newPassword });
    if ("error" in result) {
      const status = (result.error as { status?: unknown }).status;
      if (status === 400) return describeApiError(result.error);
      if (status === 401 || status === 403) return "The temporary password is incorrect.";
      if (status === 429) return "Too many attempts. Please wait and try again.";
      return "Unable to reach the server. Please try again.";
    }
    // No /auth/me re-check: clear the must-change flag on the session held in the me cache and in storage.
    dispatch(
      authApi.util.updateQueryData("me", undefined, (draft) => {
        draft.mustChangePassword = false;
      }),
    );
    if (me) writeStoredMe({ ...me, mustChangePassword: false });
    snackbar.success("Password updated", { description: "You can now use your new password." });
    return null;
  };
  const logout = async () => {
    setAccount(false);
    setSelected(null);
    setSearch("");
    const ended = await logoutRequest()
      .unwrap()
      .then(() => true)
      .catch(() => false);
    dispatch(loggedOut());
    clearStoredMe();
    // Drop every cached API response so nothing from this session survives sign-out.
    dispatch(baseApi.util.resetApiState());
    navigate({ to: "/" });
    if (ended) snackbar.success("Signed out", { description: "You have been signed out safely." });
    else
      snackbar.warning("Signed out on this device", {
        description: "The server could not be reached, so your session may still be active.",
      });
  };
  // These roles reach Master Records through a tab on Shipments, not their own menu item.
  const hasMasterTab = role === "admin" || role === "receiver" || role === "accountant";
  const isShipmentsScreen =
    displayScreen === "shipments" ||
    (hasMasterTab && displayScreen === "master") ||
    (role === "cha" && displayScreen === "cha");
  const navKeys = access[role].filter((key) => {
    if (hasMasterTab && key === "master") return false;
    if (role === "cha" && key === "cha") return false;
    return true;
  });
  // Every sign-in starts on the first sidebar item (Dashboard for all roles today), whatever page the
  // browser was on. Ordinary navigation is not affected.
  const firstMenu = navKeys[0];
  useEffect(() => {
    if (!justSignedIn.current || !apiUser || !firstMenu) return;
    justSignedIn.current = false;
    go(firstMenu);
    // `go` is recreated on every render; only a new sign-in should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUser, firstMenu]);
  if (meLoading) return null;
  if (!apiUser) return <Login onLogin={signIn} />;
  if (mustChangePassword)
    return <ChangePassword name={apiUser.name} onSubmit={changePassword} onSignOut={logout} />;
  return (
    <ReceiverDirectoryContext.Provider value={users}>
      <MasterOptionsContext.Provider value={masterOptions}>
        <WarehouseLoaderContext.Provider value={loadReceiverWarehouses}>
          <PortChaLoaderContext.Provider value={listPortChas}>
            <ProductNamesContext.Provider value={products}>
              <div
                className={`app-shell ${collapsed ? "collapsed" : ""} ${role === "cha" && displayScreen === "dashboard" ? "cha-workspace" : ""}`}
              >
                <aside className="sidebar">
                  <a href="/" className="brand" aria-label="FSC home">
                    <BrandLogo />
                    <strong>FSC</strong>
                  </a>
                  <div className="nav-label">WORKSPACE</div>
                  <nav aria-label="Main navigation">
                    {navKeys.map((key) => {
                      const Icon = icons[key];
                      const label = key === "shipments" ? "Shipments" : titles[key];
                      const isShipmentsActive = key === "shipments" && isShipmentsScreen;
                      const on = displayScreen === key || isShipmentsActive;
                      return (
                        <a
                          key={key}
                          href={paths[key]}
                          onClick={(e) => {
                            e.preventDefault();
                            go(key);
                          }}
                          title={label}
                          aria-current={on ? "page" : undefined}
                          className={`nav-link ${on ? "active" : ""}`}
                        >
                          <Icon />
                          <span>{label}</span>
                        </a>
                      );
                    })}
                  </nav>
                  <div className="sidebar-bottom">
                    <div className="workspace-label">
                      <div className="workspace-logo" aria-hidden="true">
                        F
                      </div>
                      <div>
                        <strong>FSC Workspace</strong>
                        <small>Supply chain operations</small>
                      </div>
                    </div>
                    <div className="version">
                      <span>© {new Date().getFullYear()} FSC</span>
                      <span>
                        <ShieldCheck size={12} aria-hidden="true" />
                        Signed in
                      </span>
                    </div>
                  </div>
                </aside>
                <div className="workspace-main">
                  <header className="topbar">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCollapsed((v) => !v)}
                      aria-label="Toggle sidebar"
                      title="Toggle sidebar"
                    >
                      {collapsed ? <Menu size={18} /> : <PanelLeftClose size={18} />}
                    </Button>
                    <span className="topbar-title">
                      {selected
                        ? "Shipment Details"
                        : isShipmentsScreen
                          ? "Shipments"
                          : titles[displayScreen]}
                    </span>
                    <div className="topbar-right">
                      <span className="weather-widget" title="Partly cloudy">
                        <CloudSun size={22} />
                        <b>
                          {weather.temp}°/{weather.high}°
                        </b>
                        {role === "admin" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="weather-edit"
                            aria-label="Edit weather"
                            title="Edit weather"
                            onClick={() => setWeatherEdit(true)}
                          >
                            <Pencil size={12} />
                          </Button>
                        )}
                      </span>
                      <SearchInput
                        value={search}
                        onChange={(v) => {
                          setSearch(v);
                          if (displayScreen !== "shipments" && v) {
                            go("shipments");
                            setSearch(v);
                          }
                        }}
                        placeholder="Search containers…"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        ref={bellRef}
                        className={notices ? "bell" : ""}
                        aria-label="Notifications"
                        title="Notifications"
                        onClick={() => setNotifications((v) => !v)}
                      >
                        <Bell size={17} />
                      </Button>
                      <div className="profile-wrap" ref={profileRef}>
                        <Button
                          variant="ghost"
                          className="account-button"
                          aria-label="Account menu"
                          onClick={() => setAccount((v) => !v)}
                        >
                          <span className="avatar">{current.name.slice(0, 2).toUpperCase()}</span>
                          <span>
                            {current.name}
                            <small>
                              {role === "admin"
                                ? "Administrator"
                                : `${current.role} · ${current.short}`}
                            </small>
                          </span>
                          <ChevronDown size={13} />
                        </Button>
                        {account && (
                          <div className="account-menu">
                            <p>Signed in as</p>
                            <strong className="account-role">
                              {role === "admin" ? "Administrator" : current.role}
                            </strong>
                            <Button
                              type="button"
                              variant="ghost"
                              className="logout"
                              onClick={logout}
                            >
                              <LogOut size={14} />
                              <span>Log out</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    {notifications && (
                      <div className="notification-panel" ref={notificationsRef}>
                        <div className="panel-header">
                          <h2>Notifications</h2>
                          <Button variant="link" size="sm" onClick={() => setNotices(false)}>
                            Clear all
                          </Button>
                        </div>
                        {notices ? (
                          <>
                            <div className="attention-item">
                              <div className="attention-icon">
                                <FileCheck2 size={16} />
                              </div>
                              <div>
                                <strong>Clearance assignment pending</strong>
                                <p>3 containers are awaiting assignment.</p>
                              </div>
                            </div>
                            <div className="attention-item">
                              <div className="attention-icon">
                                <CalendarDays size={16} />
                              </div>
                              <div>
                                <strong>Payment follow-up</strong>
                                <p>Rob’s final payment is ready for review.</p>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="empty-state">You’re all caught up.</div>
                        )}
                      </div>
                    )}
                  </header>
                  <main className="content">
                    <div className="breadcrumb">
                      <Home />
                      <span>Workspace</span>
                      <ChevronRight />
                      <span>{isShipmentsScreen ? "Shipments" : titles[displayScreen]}</span>
                      {selected && (
                        <>
                          <ChevronRight />
                          <span>Shipment Details</span>
                        </>
                      )}
                    </div>
                    <div className="headline-bar" aria-label="Workspace headlines">
                      {preferences.headlines.length > 1 ? (
                        <span className="headline-track">
                          {Array.from({ length: 10 }, (_, i) => (
                            <span key={i} aria-hidden={i > 0 || undefined}>
                              {preferences.headlines.join("  ·  ")}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="headline-track single">
                          {preferences.headlines[0] || " "}
                        </span>
                      )}
                    </div>
                    {!selected && (
                      <div className="page-heading">
                        <div>
                          <h1>
                            {displayScreen === "dashboard"
                              ? `Good ${"afternoon"}, ${current.name.split(" ")[0]}.`
                              : isShipmentsScreen
                                ? "Shipments"
                                : titles[displayScreen]}
                          </h1>
                          <p>
                            {isShipmentsScreen
                              ? displayScreen === "master"
                                ? descriptions.master
                                : displayScreen === "cha"
                                  ? descriptions.cha
                                  : descriptions.shipments
                              : descriptions[displayScreen]}
                          </p>
                        </div>
                        <div className="heading-actions">
                          {displayScreen === "shipments" && (
                            <Button onClick={() => setAdd(true)}>
                              <Plus size={15} />
                              Add Shipment
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                    {selected ? (
                      <ShipmentDetail
                        key={selected.vase}
                        shipment={selected}
                        master={selectedMaster}
                        availableTpt={paySummary?.availableTptBalance ?? 0}
                        tptEntries={ledgerEntries}
                        onBack={() => setSelected(null)}
                        onSave={(s) => saveEdit(s, selected.vase)}
                        payments={payments[selected.vase] || []}
                        onPayments={(p) => setPayments((ps) => ({ ...ps, [selected.vase]: p }))}
                        onDeletePayment={recordDeletedPayment}
                        {...(paySummary ? { summary: paySummary } : {})}
                        {...(paymentActions ? { paymentActions } : {})}
                      />
                    ) : (
                      <>
                        {displayScreen === "dashboard" && (
                          <Dashboard
                            shipper={current.role === "Shipper"}
                            shipperAccount={
                              isShipper ? { code: current.short, name: current.name } : undefined
                            }
                            onLedger={() => go("ledger")}
                            masterRows={delivered}
                            pending={pending}
                            onApprove={(p) => {
                              if (active.some((x) => x.vase === p.vase)) {
                                snackbar.error("Container number already exists");
                                return;
                              }
                              setMaster((rows) => [approvedShipment(p), ...rows]);
                              setPending((list) => list.filter((x) => x.id !== p.id));
                              snackbar.success("Shipment approved", {
                                description: `${p.vase} from ${p.requestedBy} is now in Active shipments`,
                              });
                            }}
                            onReject={(p, reason) => {
                              setPending((list) => list.filter((x) => x.id !== p.id));
                              snackbar.warning("Shipment rejected", {
                                description: `${p.vase} returned to ${p.requestedBy}: ${reason}`,
                              });
                            }}
                            onEdit={setEditing}
                            role={role}
                            rows={active}
                            onOpen={openShipment}
                            onShipments={() => go("shipments")}
                            onMaster={() => go("master")}
                          />
                        )}{" "}
                        {hasMasterTab &&
                          (displayScreen === "shipments" || displayScreen === "master") && (
                            <div className="tab-bar ledger-tabs">
                              {(["shipments", "master"] as const).map((k) => (
                                <Button
                                  variant="ghost"
                                  key={k}
                                  className={displayScreen === k ? "selected" : ""}
                                  onClick={() => go(k)}
                                >
                                  {k === "shipments" ? "Active" : "Master"}
                                </Button>
                              ))}
                            </div>
                          )}
                        {role === "cha" &&
                          (displayScreen === "shipments" || displayScreen === "cha") && (
                            <div className="tab-bar ledger-tabs">
                              <Button
                                variant="ghost"
                                className={displayScreen === "shipments" ? "selected" : ""}
                                onClick={() => go("shipments")}
                              >
                                Active
                              </Button>
                              <Button
                                variant="ghost"
                                className={displayScreen === "cha" ? "selected" : ""}
                                onClick={() => go("cha")}
                              >
                                All
                              </Button>
                            </div>
                          )}
                        {displayScreen === "shipments" &&
                          (isShipper ? (
                            <RoleShipmentsTable
                              kind="shipper"
                              rows={active}
                              onOpen={openShipment}
                              onEdit={setEditing}
                              onDelete={(s) => {
                                setMaster((r) => r.filter((x) => x.vase !== s.vase));
                                snackbar.success("Shipment deleted");
                              }}
                            />
                          ) : role === "cha" ? (
                            <RoleShipmentsTable
                              kind="cha"
                              rows={active}
                              onOpen={openShipment}
                              onEdit={setEditing}
                            />
                          ) : (
                            <ShipmentsTable
                              rows={activeRows}
                              onOpen={openShipment}
                              onEdit={setEditing}
                              onUpdate={update}
                              server={shipmentServerFilter}
                              serverPage={shipmentServerPage}
                            />
                          ))}{" "}
                        {displayScreen === "master" && (
                          <ShipmentsTable
                            rows={master}
                            onOpen={openShipment}
                            onEdit={setEditing}
                            onUpdate={update}
                            master
                          />
                        )}
                        {displayScreen === "ledger" && role === "accountant" && (
                          <AccountantLedger
                            key={ledgerVisit}
                            entries={ledgerEntries}
                            onEntries={setLedgerEntries}
                            debitAdvices={debitAdvices}
                            onDebitAdvices={setDebitAdvices}
                            ledgerPage={ledgerServerPage}
                          />
                        )}
                        {displayScreen === "ledger" && role !== "accountant" && (
                          <Ledger
                            key={ledgerVisit}
                            entries={ledgerEntries}
                            onEntries={setLedgerEntries}
                            shipments={master}
                            shipper={
                              isShipper ? { code: current.short, name: current.name } : undefined
                            }
                            ledgerEntry={
                              role === "admin"
                                ? {
                                    advices: debitAdvices,
                                    onAdvices: setDebitAdvices,
                                    serverPage: ledgerServerPage,
                                  }
                                : undefined
                            }
                          />
                        )}
                        {displayScreen === "meeting" && (
                          <Meeting admin={role === "admin"} self={current.short} />
                        )}
                        {displayScreen === "users" && (
                          <UserManagement
                            users={userListRows}
                            setUsers={setUsers}
                            saveUser={saveUser}
                            loadWarehouses={loadWarehouses}
                            server={userServerFilter}
                            serverPage={userServerPage}
                          />
                        )}
                        {displayScreen === "audit" && <AuditLogs users={users} />}
                        {displayScreen === "settings" && <Settings />}
                        {displayScreen === "cha" && (
                          <ChaScreen rows={master} onOpen={openShipment} onEdit={setEditing} />
                        )}
                      </>
                    )}
                    <footer className="footer">
                      {/* <span>© 2026. Supply chain operations.</span><span><i />All systems operational</span> */}
                    </footer>
                  </main>
                </div>
                {editing && (
                  <ShipmentForm
                    tpt={robTpt}
                    open
                    shipment={editing}
                    onClose={() => setEditing(null)}
                    extra={(draft, setDraft) => (
                      <ShipmentPayments
                        shipment={draft}
                        payments={payments[editing.vase] || []}
                        onPayments={(p) => setPayments((ps) => ({ ...ps, [editing.vase]: p }))}
                        paymentActions={paymentActions}
                        availableTpt={paySummary?.availableTptBalance ?? 0}
                        tptEntries={ledgerEntries}
                        onDeletePayment={recordDeletedPayment}
                        {...(paySummary ? { summary: paySummary } : {})}
                        onReserve={(mode, partial, reserved) =>
                          setDraft({
                            ...draft,
                            tptMode: mode,
                            tptPartial: partial,
                            tptReserved: String(reserved),
                          })
                        }
                      />
                    )}
                    onSave={async (s) => {
                      const problem = await saveEdit(s, editing.vase);
                      if (problem) return problem;
                      snackbar.success("Shipment updated");
                      return null;
                    }}
                  />
                )}
                {add && (
                  <ShipmentForm
                    tpt={robTpt}
                    open
                    onClose={() => setAdd(false)}
                    onSave={async (s) => {
                      if (active.some((x) => x.vase === s.vase)) {
                        snackbar.error("Container number already exists");
                        return "Container number already exists.";
                      }
                      // POST /shipments; the row is added and the pop-up closes only once the server accepts it.
                      const result = await createShipment(
                        toCreateShipmentRequest(s, masterOptions, workflowStages),
                      );
                      if ("error" in result) {
                        const message = describeApiError(result.error);
                        snackbar.error("Shipment not saved to server", { description: message });
                        return `Shipment not saved to server. ${message}`;
                      }
                      // Keep the server's UUID (needed to edit it later) and the values the server worked out.
                      const saved: Shipment = {
                        ...s,
                        ...(result.data.id ? { serverUuid: result.data.id } : {}),
                        ...(result.data.fileNo ? { dos: result.data.fileNo } : {}),
                        ...(typeof result.data.agvAmount === "number"
                          ? { agv: result.data.agvAmount.toFixed(2) }
                          : {}),
                      };
                      setMaster((rows) => [saved, ...rows.filter((x) => x.vase !== s.vase)]);
                      // Read the shipments back so the new row shows with the server's values on every list.
                      reloadShipments();
                      go("shipments");
                      snackbar.success("Shipment added", {
                        description: result.data.id
                          ? `Saved to the server (id ${result.data.id})`
                          : "Saved to the server",
                      });
                      return null;
                    }}
                  />
                )}
                <Dialog open={weatherEdit} onOpenChange={setWeatherEdit}>
                  <DialogContent>
                    <DialogTitle>Edit weather</DialogTitle>
                    <DialogDescription>Shown in the header for everyone.</DialogDescription>
                    <WeatherForm
                      weather={weather}
                      onSave={(next) => {
                        setWeather(next);
                        setWeatherEdit(false);
                        snackbar.success("Weather updated");
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </ProductNamesContext.Provider>
          </PortChaLoaderContext.Provider>
        </WarehouseLoaderContext.Provider>
      </MasterOptionsContext.Provider>
    </ReceiverDirectoryContext.Provider>
  );
}

// Header weather editor: uses the shared TextField so it matches every other form.
function WeatherForm({
  weather,
  onSave,
}: {
  weather: { temp: string; high: string };
  onSave: (next: { temp: string; high: string }) => void;
}) {
  const [temp, setTemp] = useState(weather.temp);
  const [high, setHigh] = useState(weather.high);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ temp, high });
      }}
    >
      <div className="form-grid two-col">
        <TextField label="Current" value={temp} onChange={setTemp} required />
        <TextField label="High" value={high} onChange={setHigh} required />
      </div>
      <div className="flex justify-end mt-5">
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}
