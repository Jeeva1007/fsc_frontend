import { useEffect, useRef, useState } from "react";
import { Calendar, Download, Pencil, Plus, Save, Search, Trash2, Users } from "lucide-react";
import { snackbar } from "@/components/ui/snackbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge, Combo, FilterSelect, SearchInput, TextArea, TextField } from "./fields";
import { type Shipment, type User } from "@/lib/fsc";
import { exportTable } from "@/lib/export-table";
import { CostCalculator } from "./cost-calculator";
import { WorkspaceSettings } from "./workspace-settings";
import { WarehouseEditor } from "./warehouse-editor";
import {
  checkWarehouses,
  newWarehouse,
  planWarehouseChanges,
  type Warehouse,
  type WarehouseSaveResult,
} from "@/lib/warehouse";
import type { FieldErrors } from "@/lib/login-schema";
import { USER_LIMITS, validateUser } from "@/lib/user-schema";
import { hasEntityCode } from "@/lib/users-api";
import { masterChoices, portCode } from "@/lib/master-choices";
import { useMasterOptions } from "./receiver-directory";
import { TablePagination } from "./table-pagination";
import type { ServerPage } from "@/lib/page";
import { RevealButton } from "./login";
const parties = [
  "Arctic",
  "AFNL",
  "TFA",
  "Rob",
  "GFF",
  "Q",
  "MPT",
  "acnt",
  "TFC",
  "Nargo",
  "Kam",
  "ALQ",
  "KonK",
  "Ufuk",
  "GBR",
  "BelEx",
  "FIC",
  "RPQ",
];
export function Meeting({ admin = true, self = "" }: { admin?: boolean; self?: string }) {
  const shown = admin ? parties : [self];
  const [tab, setTab] = useState("Notes");
  const [notes, setNotes] = useState<Record<string, string[]>>({
    MPT: ["Hi, How are you"],
    acnt: ["hey there"],
  });
  const [party, setParty] = useState("");
  const [note, setNote] = useState("");
  return (
    <>
      <div className="tab-bar ledger-tabs">
        {(admin ? ["Notes", "Cost Calculator"] : ["Notes"]).map((t) => (
          <Button
            variant="ghost"
            key={t}
            className={tab === t ? "selected" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </div>
      {admin && tab === "Cost Calculator" ? (
        <CostCalculator />
      ) : (
        <div className="meeting-grid screenshot-meeting">
          {shown.map((p, index) => (
            <div className={`meeting-card meeting-tone-${index % 6}`} key={p}>
              <h3>
                <span>{p}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="meeting-add"
                  aria-label={`Add note for ${p}`}
                  title={`Add note for ${p}`}
                  onClick={() => {
                    setParty(p);
                    setNote("");
                  }}
                >
                  <Plus />
                </Button>
              </h3>
              {notes[p]?.map((n, i) => (
                <div className="meeting-note" key={i}>
                  <p>{n}</p>
                  <small>{p}</small>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete note ${i + 1} for ${p}`}
                    title="Delete note"
                    onClick={() =>
                      setNotes((ns) => ({
                        ...ns,
                        [p]: (ns[p] || []).filter((_, index) => index !== i),
                      }))
                    }
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              )) || (
                <span className="meeting-empty" aria-label="No notes">
                  ◌
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <Dialog
        open={Boolean(party)}
        onOpenChange={(v) => {
          if (!v) setParty("");
        }}
      >
        <DialogContent>
          <DialogTitle>Add Note · {party}</DialogTitle>
          <DialogDescription>Share an update with your team.</DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.trim()) return;
              setNotes((ns) => ({ ...ns, [party]: [...(ns[party] || []), note] }));
              setParty("");
              snackbar.success("Note added");
            }}
          >
            <TextArea
              label="Note"
              value={note}
              onChange={setNote}
              required
              placeholder="Write your update…"
              textareaProps={{ autoFocus: true }}
            />
            <div className="flex justify-end mt-5">
              <Button type="submit">Add Note</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
/**
 * The User Management Download (Excel export) button is hidden at the user's request (2026-11-10).
 * Set this to true to show it again; the export code is kept as is.
 */
const SHOW_USER_DOWNLOAD = false;

/**
 * When `server` is given, the search box and the role/status filters are controlled by the parent and the
 * backend has already filtered the members (GET /users/usersList with search/role/status), so this screen
 * only pages through them. Without it, the three filters work on `users` in the browser as before.
 */
export type UserServerFilter = {
  search: string;
  onSearch: (v: string) => void;
  role: string;
  onRole: (v: string) => void;
  status: string;
  onStatus: (v: string) => void;
};

export function UserManagement({
  users,
  setUsers,
  saveUser,
  saveWarehouses,
  loadWarehouses,
  server,
  serverPage,
}: {
  users: User[];
  setUsers: (f: (u: User[]) => User[]) => void;
  /**
   * Saves a member on the server (POST /users/createUser or PUT /users/updateUser); resolves to an error message,
   * or null on success. Without it the screen only edits its in-memory list.
   */
  saveUser?: (user: User, password: string, original: string) => Promise<string | null>;
  /** Saves a receiver's new and changed warehouses on the server, after the member itself is saved. */
  saveWarehouses?: (
    user: User,
    list: Warehouse[],
    removed?: Warehouse[],
  ) => Promise<WarehouseSaveResult>;
  /** Reads a receiver's warehouses from the server when Edit opens; null when there is no linked receiver. */
  loadWarehouses?: (user: User) => Promise<{ list: Warehouse[] } | { error: string } | null>;
  /** When set, search/role/status are controlled by the parent and the rows arrive already filtered. */
  server?: UserServerFilter;
  /** When set, the footer pages through the backend instead of slicing the rows in the browser. */
  serverPage?: ServerPage;
}) {
  const master = useMasterOptions();
  // A CHA works at a port rather than a general location; their POD is saved as the location, by code.
  const pods = masterChoices(master, "ports", []);
  // Country = GET /users/countryDropdown only, shown "Name (CODE)", stored as the code. No built-in list:
  // until it loads the menu is empty (a saved user's code still shows).
  const countries = masterChoices(master, "userCountries", []);
  const usesPod = (role: string) => role === "CHA" && pods.fromMaster;
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [original, setOriginal] = useState("");
  // Set once the member exists but some warehouses failed: only those are left to retry, never the member.
  const [retry, setRetry] = useState<{
    saved: Warehouse[];
    removed: Warehouse[];
    problems: string[];
  } | null>(null);
  const [whErrors, setWhErrors] = useState<FieldErrors[]>([]);
  const [userErrors, setUserErrors] = useState<FieldErrors>({});
  const [password, setPassword] = useState("");
  // The password starts hidden; the eye button in the field shows it while editing this member.
  const [showPassword, setShowPassword] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [remove, setRemove] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [whLoad, setWhLoad] = useState<{ error?: string } | null>(null);
  // Only the latest load may fill the form: the pop-up can close or move on to another member meanwhile.
  const latestLoad = useRef(0);
  // What the server returned for the member being edited, to see what Save has to send.
  const loadedWarehouses = useRef<Warehouse[]>([]);
  const bindWarehouses = async (member: User) => {
    if (!loadWarehouses || member.role !== "Receiver") return;
    const load = ++latestLoad.current;
    loadedWarehouses.current = [];
    setWhLoad({});
    const result = await loadWarehouses(member);
    if (load !== latestLoad.current) return;
    if (result && "error" in result) {
      setWhLoad({ error: result.error });
      return;
    }
    setWhLoad(null);
    if (!result) return;
    loadedWarehouses.current = result.list;
    // Warehouses added on this screen earlier are not on the server, so they stay.
    setUser(
      (current) =>
        current && {
          ...current,
          warehouses: [
            ...result.list,
            ...(current.warehouses ?? []).filter((w) => w.serverId === undefined),
          ],
        },
    );
  };
  const closeDialog = () => {
    latestLoad.current += 1;
    setWhLoad(null);
    setUser(null);
    setPassword("");
    setShowPassword(false);
    setRetry(null);
  };
  // In server mode the backend already applied search/role/status, so show the rows as they arrive;
  // otherwise filter them here. A new server filter resets to the first page (see the effect below).
  const filtered = server
    ? users
    : users.filter(
        (u) =>
          (!roleFilter || u.role === roleFilter) &&
          (!statusFilter || (u.status || "Active") === statusFilter) &&
          Object.values({ ...u, password: "" })
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase()),
      );
  useEffect(() => {
    if (server) setPage(1);
  }, [server?.search, server?.role, server?.status, server]);
  // The toolbar binds to the parent in server mode, or to local state otherwise.
  const searchValue = server ? server.search : query;
  const onSearchChange = server
    ? server.onSearch
    : (v: string) => {
        setQuery(v);
        setPage(1);
      };
  const roleValue = server ? server.role : roleFilter;
  const onRoleChange = server
    ? server.onRole
    : (v: string) => {
        setRoleFilter(v);
        setPage(1);
      };
  const statusValue = server ? server.status : statusFilter;
  const onStatusChange = server
    ? server.onStatus
    : (v: string) => {
        setStatusFilter(v);
        setPage(1);
      };
  const anyFilter = Boolean(searchValue || roleValue || statusValue);
  const clearFilters = () => {
    if (server) {
      server.onSearch("");
      server.onRole("");
      server.onStatus("");
    } else {
      setQuery("");
      setRoleFilter("");
      setStatusFilter("");
    }
    setPage(1);
  };
  const pageSize = serverPage ? serverPage.size : size;
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  // Server-paged: rows already are the current page; otherwise slice locally.
  const visible = serverPage
    ? filtered
    : filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return (
    <>
      <div className="panel shipments-panel">
        <div className="table-toolbar">
          <SearchInput
            value={searchValue}
            onChange={onSearchChange}
            placeholder="Search name, username or role…"
          />
          <FilterSelect
            ariaLabel="Filter role"
            allLabel="All roles"
            options={["Admin", "Shipper", "Receiver", "CHA", "Accountant"]}
            value={roleValue}
            onChange={onRoleChange}
          />
          <FilterSelect
            ariaLabel="Filter member status"
            allLabel="All statuses"
            options={["Active", "Inactive"]}
            value={statusValue}
            onChange={onStatusChange}
          />
          {anyFilter && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              Clear
            </Button>
          )}
          <div className="toolbar-end">
            {SHOW_USER_DOWNLOAD && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  exportTable({
                    fileName: "users",
                    title: "User Management",
                    columns: [
                      "Full Name",
                      "Display Name",
                      "User ID",
                      "Role",
                      "Status",
                      "Country",
                      "Location",
                    ],
                    rows: filtered.map((u) => [
                      u.name,
                      u.short,
                      u.username,
                      u.role,
                      u.status || "Active",
                      u.country,
                      u.port,
                    ]),
                  })
                }
              >
                <Download />
                Download
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                setPassword("");
                setShowPassword(false);
                setWhErrors([]);
                setUserErrors({});
                setOriginal("");
                setUser({
                  name: "",
                  username: "",
                  short: "",
                  role: "Shipper",
                  status: "Active",
                  country: "",
                  port: "",
                  password: "",
                });
              }}
            >
              <Plus />
              Add User
            </Button>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Full Name",
                  "User ID",
                  "Display Name",
                  "Role",
                  "Status",
                  "Country",
                  "Location",
                  "Actions",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.username}>
                  <td>
                    <span className="flex items-center gap-3">
                      <span className="avatar">{u.name.slice(0, 2).toUpperCase()}</span>
                      {u.name}
                    </span>
                  </td>
                  <td>{u.username}</td>
                  <td>{u.short}</td>
                  <td>{u.role}</td>
                  <td>
                    <Badge status={u.status || "Active"} />
                  </td>
                  <td>{u.country}</td>
                  <td>{u.port}</td>
                  <td>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${u.name}`}
                      onClick={() => {
                        setPassword("");
                        setShowPassword(false);
                        setWhErrors([]);
                        setUserErrors({});
                        setOriginal(u.username);
                        setUser(usesPod(u.role) ? { ...u, port: portCode(master, u.port) } : u);
                        void bindWarehouses(u);
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${u.name}`}
                      disabled={u.role === "Admin"}
                      onClick={() => setRemove(u.username)}
                    >
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={8} className="empty-state">
                    No matching users
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={serverPage ? serverPage.page : currentPage}
          pageSize={pageSize}
          total={serverPage ? serverPage.total : filtered.length}
          onPage={serverPage ? serverPage.onPage : setPage}
          {...(serverPage
            ? serverPage.onPageSize
              ? { onPageSize: serverPage.onPageSize }
              : {}
            : {
                onPageSize: (n: number) => {
                  setSize(n);
                  setPage(1);
                },
              })}
          pageSizes={[10, 25, 50, 100]}
          noun="users"
        />
      </div>
      <Dialog
        open={Boolean(user)}
        onOpenChange={(v) => {
          if (!v) closeDialog();
        }}
      >
        <DialogContent className="user-dialog">
          <DialogTitle>
            {retry
              ? original
                ? "Update Warehouses"
                : "Add Warehouses"
              : original
                ? "Edit User"
                : "Add User"}
          </DialogTitle>
          <DialogDescription>
            {retry
              ? `${user?.name} was ${original ? "saved" : "created"}. Their warehouses below still need saving.`
              : "Workspace member details for this preview."}
          </DialogDescription>
          {user && (
            <form
              noValidate
              onSubmit={async (e) => {
                e.preventDefault();
                if (saving) return;
                // All field rules live in the Yup schemas (user-schema.ts / warehouse.ts).
                const found = retry
                  ? null
                  : validateUser(
                      {
                        name: user.name,
                        username: user.username,
                        short: user.short,
                        password,
                      },
                      users.filter((u) => u.username !== original).map((u) => u.username),
                      !original,
                    );
                const checked =
                  user.role === "Receiver" ? checkWarehouses(user.warehouses ?? []) : null;
                const noPod = !retry && usesPod(user.role) && !user.port;
                setUserErrors({ ...found, ...(noPod ? { port: "Choose the POD." } : {}) });
                setWhErrors(checked?.errors ?? []);
                if (found || noPod || (checked && !checked.valid)) return;
                const { warehouses: draft = [], ...rest } = user;
                let warehouses: typeof draft = [];
                if (checked) warehouses = checked.cleaned;
                const saved = {
                  ...rest,
                  password: password || user.password,
                  ...(warehouses.length ? { warehouses } : {}),
                };
                // A failed load means the server's list is unknown, so nothing can be compared with it.
                const changes =
                  !saveWarehouses || !checked || whLoad?.error
                    ? null
                    : retry
                      ? { save: warehouses, unchanged: retry.saved, removed: retry.removed }
                      : original
                        ? planWarehouseChanges(loadedWarehouses.current, warehouses)
                        : { save: warehouses, unchanged: [], removed: [] };
                if (saveUser && !retry) {
                  setSaving(true);
                  const message = await saveUser(saved, password, original);
                  setSaving(false);
                  if (message) {
                    snackbar.error("Member not saved", { description: message });
                    return;
                  }
                }
                // The server list may already hold the new member, so this merges instead of adding a second row.
                const commit = (member: User) =>
                  setUsers((us) =>
                    us.some((u) => u.username === (original || member.username))
                      ? us.map((u) =>
                          u.username === (original || member.username)
                            ? original
                              ? member
                              : { ...u, ...member }
                            : u,
                        )
                      : [...us, member],
                  );
                let final = saved;
                if (saveWarehouses && changes) {
                  setSaving(true);
                  const result = await saveWarehouses(saved, changes.save, changes.removed);
                  setSaving(false);
                  const stored = [...changes.unchanged, ...result.saved];
                  final = {
                    ...rest,
                    password: saved.password,
                    ...(stored.length ? { warehouses: stored } : {}),
                  };
                  const failedRemovals = result.failedRemovals ?? [];
                  if (result.failed.length || failedRemovals.length) {
                    commit(final);
                    setWhErrors([]);
                    setUser({ ...user, warehouses: result.failed.map((f) => f.warehouse) });
                    setRetry({
                      saved: stored,
                      removed: failedRemovals.map((f) => f.warehouse),
                      problems: [
                        ...result.failed.map((f) => `${f.warehouse.name}: ${f.message}`),
                        ...failedRemovals.map(
                          (f) => `${f.warehouse.name} (not removed): ${f.message}`,
                        ),
                      ],
                    });
                    snackbar.error("Some warehouses not saved", {
                      description: `${result.failed.length + failedRemovals.length} of ${changes.save.length + changes.removed.length} could not be saved.`,
                    });
                    return;
                  }
                  const sent = changes.save.length + changes.removed.length;
                  commit(final);
                  closeDialog();
                  snackbar.success(
                    retry
                      ? "Warehouses saved"
                      : !sent
                        ? "Member saved"
                        : original
                          ? "Member and warehouses saved"
                          : `Member and ${stored.length} ${stored.length === 1 ? "warehouse" : "warehouses"} saved`,
                  );
                  return;
                }
                commit(final);
                closeDialog();
                snackbar.success(saveUser ? "Member saved" : "Member saved — they can now sign in");
              }}
            >
              {retry && (
                <div className="wh-retry" role="alert">
                  <strong>These warehouses were not saved</strong>
                  <ul>
                    {retry.problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  <p>Correct them and try again, or close to add them later.</p>
                </div>
              )}
              {!retry && (
                <div className="form-grid two-col">
                  <TextField
                    label="Full Name"
                    value={user.name}
                    onChange={(v) => {
                      setUserErrors((e) => ({ ...e, name: "" }));
                      setUser({ ...user, name: v });
                    }}
                    error={userErrors["name"] || undefined}
                    placeholder="Enter full name"
                    required
                  />
                  <TextField
                    label="Display Name"
                    value={user.short}
                    onChange={(v) => {
                      setUserErrors((e) => ({ ...e, short: "" }));
                      setUser({ ...user, short: v });
                    }}
                    error={userErrors["short"] || undefined}
                    placeholder="Enter display name"
                    required
                  />
                  <TextField
                    label="User ID"
                    value={user.username}
                    onChange={(v) => {
                      setUserErrors((e) => ({ ...e, username: "" }));
                      setUser({ ...user, username: v });
                    }}
                    error={userErrors["username"] || undefined}
                    placeholder="Enter user ID"
                    required
                  />
                  <TextField
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    required={!original}
                    value={password}
                    onChange={(v) => {
                      setUserErrors((e) => ({ ...e, password: "" }));
                      setPassword(v);
                    }}
                    error={userErrors["password"] || undefined}
                    placeholder={original ? "Leave unchanged" : "Enter password"}
                    // This is the member's password, not the admin's: never autofill the admin's own.
                    inputProps={{ autoComplete: "new-password" }}
                    endAdornment={
                      <RevealButton
                        compact
                        shown={showPassword}
                        onToggle={() => setShowPassword((v) => !v)}
                        label="password"
                      />
                    }
                  />
                  <Combo
                    label="Role"
                    value={user.role}
                    options={["Admin", "Shipper", "Receiver", "CHA", "Accountant"]}
                    onChange={(v) => {
                      setWhErrors([]);
                      setUser({
                        ...user,
                        role: v,
                        // POD codes and locations are different lists, so a move between them starts over.
                        ...(usesPod(v) && !usesPod(user.role) ? { port: "" } : {}),
                        ...(!usesPod(v) && usesPod(user.role) ? { port: "" } : {}),
                        ...(v === "Receiver" && !user.warehouses?.length
                          ? { warehouses: [newWarehouse()] }
                          : {}),
                      });
                    }}
                    create={false}
                  />
                  <Combo
                    label="Status"
                    value={user.status || "Active"}
                    options={["Active", "Inactive"]}
                    create={false}
                    onChange={(v) => setUser({ ...user, status: v })}
                  />
                  <Combo
                    label="Country"
                    value={user.country}
                    options={countries.choices}
                    create={false}
                    placeholder="Select Country"
                    menuPlacement="fixed"
                    onChange={(v) => setUser({ ...user, country: v })}
                  />
                  {usesPod(user.role) ? (
                    <Combo
                      label="POD"
                      required
                      create={false}
                      value={user.port}
                      options={pods.choices}
                      placeholder="Select POD"
                      // The list is long, and a menu inside the pop-up would be cut off at its edge.
                      menuPlacement="fixed"
                      error={userErrors["port"] || undefined}
                      onChange={(v) => {
                        setUserErrors((e) => ({ ...e, port: "" }));
                        setUser({ ...user, port: v });
                      }}
                    />
                  ) : (
                    <TextField
                      label="Location"
                      value={user.port}
                      placeholder="Enter location"
                      onChange={(v) => setUser({ ...user, port: v })}
                      inputProps={{ autoComplete: "off", maxLength: USER_LIMITS.location }}
                    />
                  )}
                  <TextField
                    label="Email ID"
                    type="email"
                    wide={!hasEntityCode(user.role)}
                    value={user.email ?? ""}
                    onChange={(v) => {
                      setUserErrors((e) => ({ ...e, email: "" }));
                      setUser({ ...user, email: v });
                    }}
                    error={userErrors["email"] || undefined}
                    placeholder="name@company.com"
                    inputProps={{ autoComplete: "off", maxLength: USER_LIMITS.email }}
                  />
                  {hasEntityCode(user.role) && (
                    <TextField
                      label="Entity Code"
                      value={user.linked ?? ""}
                      onChange={(v) => setUser({ ...user, linked: v })}
                      placeholder={original ? "Enter entity code" : "Auto-filled from Full Name"}
                      inputProps={{ autoComplete: "off" }}
                    />
                  )}
                </div>
              )}
              {user.role === "Receiver" && whLoad && !whLoad.error && (
                <p className="wh-load" role="status">
                  Loading warehouses…
                </p>
              )}
              {user.role === "Receiver" && whLoad?.error && (
                <div className="wh-load wh-load-error" role="alert">
                  <span>Warehouses could not be loaded. {whLoad.error}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void bindWarehouses(user)}
                  >
                    Try again
                  </Button>
                </div>
              )}
              {user.role === "Receiver" && !whLoad && (
                <WarehouseEditor
                  value={user.warehouses ?? []}
                  errors={whErrors}
                  onChange={(warehouses) => {
                    setWhErrors([]);
                    setUser({ ...user, warehouses });
                  }}
                />
              )}
              <div className="dialog-actions flex justify-end gap-2 mt-6">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  {retry ? "Close" : "Cancel"}
                </Button>
                <Button type="submit" disabled={saving || Boolean(whLoad && !whLoad.error)}>
                  {saving ? "Saving…" : retry ? "Save Warehouses" : "Save User"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(remove)}
        onOpenChange={(v) => {
          if (!v) setRemove(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Remove member?</DialogTitle>
          <DialogDescription>
            {saveUser
              ? "The server cannot delete members, so this deactivates them. They can no longer sign in."
              : "This removes the member from the current preview."}
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const target = users.find((u) => u.username === remove);
                if (saveUser && target) {
                  const message = await saveUser(
                    { ...target, status: "Inactive" },
                    "",
                    target.username,
                  );
                  if (message) {
                    snackbar.error("Member not deactivated", { description: message });
                    return;
                  }
                  setUsers((us) =>
                    us.map((u) => (u.username === remove ? { ...u, status: "Inactive" } : u)),
                  );
                  setRemove(null);
                  snackbar.success("Member deactivated");
                  return;
                }
                setUsers((us) => us.filter((u) => u.username !== remove));
                setRemove(null);
                snackbar.success("Member removed");
              }}
            >
              {saveUser ? "Deactivate" : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function Settings() {
  return <WorkspaceSettings />;
}
export function ChaScreen({
  rows,
  onOpen,
  onEdit,
}: {
  rows: Shipment[];
  onOpen: (s: Shipment) => void;
  onEdit: (s: Shipment) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [pol, setPol] = useState("");
  const pols = [...new Set(rows.map((r) => r.pol).filter(Boolean))];
  const filtered = rows.filter(
    (x) =>
      Object.values(x).join(" ").toLowerCase().includes(query.toLowerCase()) &&
      (!filter || x.status === filter) &&
      (!pol || x.pol === pol),
  );
  return (
    <div className="panel">
      <div className="table-toolbar">
        <SearchInput value={query} onChange={setQuery} />
        <FilterSelect
          ariaLabel="CHA Status"
          allLabel="CHA Status"
          options={[...new Set(rows.map((r) => r.status))]}
          value={filter}
          onChange={setFilter}
        />
        <FilterSelect
          ariaLabel="All POLs"
          allLabel="All POLs"
          options={pols}
          value={pol}
          onChange={setPol}
        />
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {[
                "Liner",
                "Vase",
                "ETA",
                "CHA Status",
                "POL",
                "POD",
                "CHA Description",
                "Action",
              ].map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.vase}>
                <td className="font-semibold">{s.liner || "Other"}</td>
                <td>
                  <Button variant="link" className="link-button" onClick={() => onOpen(s)}>
                    {s.vase}
                  </Button>
                </td>
                <td>{s.eta}</td>
                <td>{s.status}</td>
                <td>{s.pol}</td>
                <td>{s.pod}</td>
                <td>{s.chaDescription || "—"}</td>
                <td>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${s.vase}`}
                    onClick={() => onEdit(s)}
                  >
                    <Pencil />
                  </Button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={8} className="empty-state">
                  No shipments match
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
