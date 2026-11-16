import { uid as newId } from "@/lib/id";
import { isEnhancementAgency } from "@/lib/shipment-list";
import { snackbar } from "@/components/ui/snackbar";
import {
  PENDING_PAYMENT_MESSAGE,
  PendingPaymentContext,
  type PendingPayment,
} from "./pending-payment";
import { useContext, useEffect, useId, useMemo, useState, type ReactNode, useRef } from "react";
import {
  Calculator,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  FileText,
  Package,
  Plus,
  Ship,
  Trash2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AgencyDropdown, Combo, Field, TextArea, TextField } from "./fields";
import {
  agvTotal,
  DEFAULT_UNIT,
  money,
  stageCheckboxes,
  statuses,
  type CostLine,
  type Shipment,
} from "@/lib/fsc";
import { safeImageSrc } from "@/lib/security";
import {
  useMasterOptions,
  useReceiverDirectory,
  ProductNamesContext,
  usePortChas,
  useReceiverWarehouses,
} from "./receiver-directory";
import {
  deliveryOf,
  matchWarehouse,
  needsWarehouseChoice,
  syncDelivery,
} from "@/lib/receiver-warehouses";
import { agencyOptions, masterChoices } from "@/lib/master-choices";
import type { SelectOption } from "@/components/common/form";
const empty: Shipment = {
  vase: "",
  vsub: "",
  status: "Shipment created",
  ssub: "",
  reference: "",
  rcv: "",
  eta: "",
  dos: "",
  pol: "",
  pod: "",
  shp: "",
  desc: "",
  dsub: "",
  agv: "0",
  gsm: "0",
  gsmd: "",
  bull: "0",
  bulld: "",
  tp: "0",
  sw: "0",
  inv: "",
  // One shipment is one container.
  containers: "1",
  cha: "",
  agency: "",
  enhancement: "",
  cartons: "",
  liner: "",
  be: "",
  beDate: "",
  beType: "",
  note: "",
  awaitingPhysicalDocs: false,
  receivedPhysicalDocs: false,
  physicalDocsSentToCha: false,
  awaitingTelex: false,
};
export function ShipmentFields({
  form,
  setForm,
  tpt,
  warehouseError,
  receiver,
  layout = "flat",
  stickyNav = true,
  hideFinancial = false,
}: {
  form: Shipment;
  setForm: (value: Shipment) => void;
  tpt?: number | undefined;
  /** Shows that the receiver's delivery warehouse still has to be chosen. */
  warehouseError?: boolean;
  /** The receiver's warehouses (useReceiverWarehouses). */
  receiver: ReturnType<typeof useReceiverWarehouses>;
  /** "flat" keeps the single grid used on the details page; "sections" is the grouped layout used in the dialog. */
  layout?: "flat" | "sections";
  /** Pin the section jump bar while scrolling (pop-up); false keeps it in the page flow. */
  stickyNav?: boolean;
  /** Leaves the Financial section out (Add and Edit Shipment hide it for now). */
  hideFinancial?: boolean;
}) {
  const uid = useId();
  const [showComposition, setShowComposition] = useState(true);
  // Dropdowns bind to GET /masters/options when it has loaded; the built-in lists are the fallback.
  const master = useMasterOptions();
  const warehouses = receiver.list;
  const portChas = usePortChas(form.pod);
  const products = useContext(ProductNamesContext);
  const directoryHasMembers = useReceiverDirectory().length > 0;
  // A receiver's only warehouse is used automatically; a choice no longer on the list is cleared.
  useEffect(() => {
    const next = syncDelivery(form, warehouses);
    if (next !== form) setForm(next);
  }, [form, warehouses, setForm]);
  const agencies = form.agency?.split(", ").filter(Boolean) || [];
  const set = (key: keyof Shipment, value: string) => {
    if (key === "reference") setForm({ ...form, reference: value, ssub: value });
    else if (key === "ssub") setForm({ ...form, ssub: value, reference: value });
    // A warehouse belongs to its receiver, so changing the receiver starts over.
    else if (key === "rcv") setForm({ ...form, rcv: value, ...deliveryOf() });
    // The CHA depends on the POD, so a different POD means choosing the CHA again.
    else if (key === "pod")
      setForm({
        ...form,
        pod: value,
        ...(value !== form.pod ? { cha: "", chaId: undefined } : {}),
      });
    else setForm({ ...form, [key]: value });
  };
  const combo = (
    label: string,
    key: keyof Shipment,
    options: SelectOption[],
    create = true,
    locked?: string,
  ) => (
    <Combo
      label={label}
      value={String(form[key] || "")}
      onChange={(v) => set(key, v)}
      options={options}
      create={create}
      {...(locked ? { disabled: true, placeholder: locked } : {})}
    />
  );
  // A dropdown fed by one master list (e.g. "shippers"), with the old static values as fallback.
  const masterCombo = (
    label: string,
    key: keyof Shipment,
    list: string,
    fallback: string[],
    locked?: string,
    allowNew = false,
  ) => {
    const { choices, fromMaster } = masterChoices(master, list, fallback);
    return combo(label, key, choices, allowNew || !fromMaster, locked);
  };
  const text = (
    label: string,
    key: keyof Shipment,
    type = "text",
    placeholder?: string,
    required = false,
  ) => (
    <TextField
      label={label}
      value={String(form[key] || (key === "reference" ? form.ssub : "") || "")}
      onChange={(v) => set(key, v)}
      type={type}
      placeholder={placeholder}
      required={required}
    />
  );
  const shipperField = masterCombo("Shipper", "shp", "shippers", [
    "TFC",
    "Arctic",
    "Nargo",
    "Rob",
    "AFNL",
    "Kam",
    "WP",
    "KonK",
  ]);
  const receiverField = masterCombo("Receiver", "rcv", "parties", [
    "GMF",
    "TFA",
    "FIC",
    "GBR",
    "GFF",
  ]);
  // Product names come from GET /shipments/productDropdown; the name chosen is what is saved. The field lets
  // a name be typed too, so it still works before the list has loaded.
  const descriptionField = combo("Product", "chaDescription", products);
  const statusField = combo("Status", "status", statuses);
  const productField = text("Product Description", "desc", "text", "Product description");
  const cartonsField = text("No. of Cartons", "cartons", "text", "Enter no. of cartons");
  const etaField = text("ETA", "eta", "date");
  const dossierField = text("Dossier No", "dos", "text", "Enter dossier number", true);
  const invoiceField = text("Sales Invoice No", "inv", "text", "e.g. OX/2026/060");
  // Product, POL and POD can take a value that is not on the list yet, through "Add “x”" in the menu.
  const polField = masterCombo(
    "POL",
    "pol",
    "countries",
    ["BR", "US", "NZ", "PL"],
    undefined,
    true,
  );
  const podField = masterCombo(
    "POD",
    "pod",
    "ports",
    ["BOM", "CHE", "KOL", "DEL"],
    undefined,
    true,
  );
  // Once a POD is chosen, the CHA list is that port's. If it cannot be loaded, all CHAs stay available.
  const chaField =
    portChas.active && !portChas.error ? (
      <Combo
        label="CHA"
        create={false}
        value={form.cha || ""}
        disabled={portChas.loading || !portChas.choices.length}
        placeholder={
          portChas.loading
            ? "Loading CHAs…"
            : portChas.choices.length
              ? "Select CHA"
              : "No CHA for this POD"
        }
        options={portChas.choices}
        onChange={(code) =>
          setForm({
            ...form,
            cha: code,
            chaId: portChas.choices.find((c) => c.value === code)?.chaId,
          })
        }
      />
    ) : (
      masterCombo(
        "CHA",
        "cha",
        "chas",
        ["MPT", "InterlinkShipping", "acnt"],
        form.pod ? undefined : "Select POD first",
      )
    );
  const linerField = masterCombo("Liner", "liner", "shippingLines", [
    "CMA",
    "Hapag-Lloyd",
    "Evergreen",
    "OOCL",
    "ONE",
    "Maersk",
  ]);
  const blField = text("BL No", "vsub", "text", "Enter bill of lading number");
  const vaseField = text("Vase / Container No", "vase", "text", "e.g. SEGU9423661", true);
  // The AGV is always typed by the user; the composition below is a separate, informational breakdown and
  // never overwrites this field.
  const compLines = form.breakdown ?? [];
  const compTotal = agvTotal(compLines);
  const agvField = (
    <Field label="AGV">
      <TextField ariaLabel="AGV" type="number" value={form.agv} onChange={(v) => set("agv", v)} />
    </Field>
  );
  // Writes the lines back; the AGV field is left exactly as the user typed it.
  const setLines = (next: CostLine[]) => setForm({ ...form, breakdown: next });
  const addLine = () =>
    setLines([
      ...compLines,
      { id: newId(), product: "", unit: DEFAULT_UNIT, quantity: "", cost: "" },
    ]);
  const updateLine = (id: string, key: keyof CostLine, value: string) =>
    setLines(compLines.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
  const removeLine = (id: string) => setLines(compLines.filter((l) => l.id !== id));
  // The itemised goods value: one priced line per product, summed into the AGV. The client ships everything
  // in cartons, so the unit is fixed and not shown as a choice.
  const agvComposition = (
    <div className="agv-breakdown">
      <Button
        type="button"
        variant="ghost"
        className="breakdown-toggle"
        onClick={() => setShowComposition((v) => !v)}
      >
        <span className="breakdown-title">
          <Calculator size={15} />
          AGV Composition
          <span className="count">{compLines.length} items</span>
        </span>
        <span className="breakdown-title">
          <strong>{money(compTotal)}</strong>
          {showComposition ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </Button>
      {showComposition && (
        <div className="breakdown-body">
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus size={15} />
            Add product
          </Button>
          {compLines.map((line) => (
            <div className="cost-line" key={line.id}>
              {products.length ? (
                <Combo
                  label="Product"
                  value={line.product}
                  onChange={(v) => updateLine(line.id, "product", v)}
                  options={products}
                  create
                />
              ) : (
                <TextField
                  label="Product"
                  value={line.product}
                  placeholder="Product name"
                  onChange={(v) => updateLine(line.id, "product", v)}
                />
              )}
              <TextField
                label="Quantity"
                type="number"
                value={line.quantity}
                placeholder="0"
                endAdornment="Cartons"
                onChange={(v) => updateLine(line.id, "quantity", v)}
              />
              <TextField
                label="Unit price"
                type="number"
                value={line.cost}
                placeholder="0.00"
                onChange={(v) => updateLine(line.id, "cost", v)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove product"
                onClick={() => removeLine(line.id)}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
          <div className="breakdown-total">
            <p>Total goods value</p>
            <strong>{money(compTotal)}</strong>
          </div>
        </div>
      )}
    </div>
  );
  const chosenWarehouse = matchWarehouse(warehouses, form);
  const warehouseDetails = (
    <>
      <TextField
        label="Warehouse location"
        readOnly
        value={form.warehouseLocation || ""}
        placeholder="Shown after a warehouse is chosen"
        onChange={() => {}}
      />
      <TextField
        label="Warehouse WhatsApp"
        readOnly
        value={form.warehouseWhatsapp || ""}
        placeholder="Shown after a warehouse is chosen"
        onChange={() => {}}
      />
    </>
  );
  const deliveryBlock = receiver.loading ? (
    <p className="ship-delivery-note" role="status">
      Loading warehouses…
    </p>
  ) : receiver.error ? (
    <div className="ship-delivery-note ship-delivery-error" role="alert">
      <span>Warehouses could not be loaded. {receiver.error}</span>
      <Button type="button" size="sm" variant="outline" onClick={receiver.retry}>
        Try again
      </Button>
    </div>
  ) : warehouses.length > 1 ? (
    <div className="ship-delivery">
      <Combo
        label="Delivery warehouse"
        required
        create={false}
        placeholder="Select warehouse"
        value={chosenWarehouse?.id ?? ""}
        onChange={(id) => setForm({ ...form, ...deliveryOf(warehouses.find((w) => w.id === id)) })}
        options={warehouses.map((w) => ({
          value: w.id,
          label: w.location ? `${w.name} — ${w.location}` : w.name,
        }))}
        error={warehouseError && !chosenWarehouse ? "Choose the delivery warehouse." : undefined}
      />
      {warehouseDetails}
    </div>
  ) : warehouses.length === 1 ? (
    <div className="ship-delivery">
      <TextField
        label="Delivery warehouse"
        readOnly
        value={form.warehouse || ""}
        hint="This receiver's only warehouse"
        onChange={() => {}}
      />
      {warehouseDetails}
    </div>
  ) : form.warehouseWhatsapp ? (
    <div className="ship-delivery">
      <TextField
        label="Warehouse WhatsApp"
        readOnly
        value={form.warehouseWhatsapp}
        onChange={() => {}}
      />
    </div>
  ) : form.rcv && (receiver.fromServer || directoryHasMembers) ? (
    <p className="ship-delivery-note">
      No warehouse saved for this receiver. Add one in User Management to choose a delivery
      warehouse.
    </p>
  ) : null;
  const tptBlock = (
    <>
      {form.shp === "Rob" && tpt !== undefined && (
        <Field label="TPT Transfer (Rob ledger)">
          <TextField ariaLabel="TPT Transfer" readOnly value={money(tpt)} onChange={() => {}} />
        </Field>
      )}
    </>
  );
  const docsBlock = (
    <div className="document-checkboxes-grid">
      {stageCheckboxes.map((item) => (
        <label key={item.key} className={`doc-checkbox-card ${form[item.key] ? "checked" : ""}`}>
          <input
            type="checkbox"
            checked={Boolean(form[item.key])}
            onChange={(e) => {
              const val = e.target.checked;
              setForm({
                ...form,
                [item.key]: val,
                docCheckboxes: { ...(form.docCheckboxes || {}), [item.key]: val },
              });
            }}
          />
          <div>
            {/* <span className="doc-checkbox-badge">Step {item.step} · {item.role}</span> */}
            <strong className="doc-checkbox-title">{item.label}</strong>
          </div>
        </label>
      ))}
    </div>
  );
  const clearanceFields = (
    <>
      {text("BE No", "be", "text", "Enter BE number")}
      {text("BE Date", "beDate", "date")}
      {combo("BE Type", "beType", ["Ass", "RMS"])}
      <AgencyDropdown
        value={form.agency || ""}
        onChange={(v) => set("agency", v)}
        options={agencyOptions(master)}
      />
      {agencies.some((a) => isEnhancementAgency(a, master)) &&
        text("Enhancement amount", "enhancement", "number", "Enter enhancement amount")}
      <TextArea
        label="Status Note"
        wide
        value={form.note || ""}
        placeholder="Additional shipment notes"
        onChange={(v) => set("note", v)}
      />
    </>
  );
  const financialBlock = (
    <details className="field-wide financial-details">
      <summary>Financial reference & additional details</summary>
      <div className="form-grid mt-5">
        {text("GSM", "gsm", "number")}
        {text("GSM Date", "gsmd", "date")}
        {text("Bull / OX", "bull", "number")}
        {text("OX Date", "bulld", "date")}
        {text("TP / TPT", "tp", "number")}
        {text("Sweet", "sw", "number")}
        {text("Description detail", "dsub")}
        {text("Reference", "reference", "text", "Enter reference")}
        <Field label="Upload screenshot">
          <div className="flex flex-col gap-2">
            {form.finScreenshot && (
              <a
                href={safeImageSrc(form.finScreenshot)}
                target="_blank"
                rel="noreferrer"
                aria-label="View financial screenshot"
              >
                <img
                  src={safeImageSrc(form.finScreenshot)}
                  alt="Financial screenshot"
                  className="h-12 w-16 rounded-sm border object-cover"
                />
              </a>
            )}
            <input
              aria-label="Financial reference screenshot"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (!file || !file.type.startsWith("image/")) return;
                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result === "string") set("finScreenshot", reader.result);
                };
                reader.onerror = () => {};
                reader.readAsDataURL(file);
              }}
            />
          </div>
        </Field>
      </div>
    </details>
  );
  if (layout === "flat") {
    return (
      <div className="form-grid shipment-fields">
        <div className="form-section-title">
          <Package />
          Shipment information
        </div>
        {shipperField}
        {receiverField}
        {descriptionField}
        {statusField}
        {productField}
        {agvField}
        {cartonsField}
        {etaField}
        {dossierField}
        {invoiceField}
        {polField}
        {podField}
        {chaField}
        {deliveryBlock}
        {linerField}
        {blField}
        {vaseField}
        {tptBlock}
        <div className="form-section-title">
          <CheckSquare />
          Document stages
        </div>
        {docsBlock}
        <div className="form-section-title">
          <FileText />
          Clearance information
        </div>
        {clearanceFields}
        {financialBlock}
      </div>
    );
  }
  const sections: {
    id: string;
    label: string;
    hint: string;
    icon: ReactNode;
    content: ReactNode;
  }[] = [
    {
      id: "route",
      label: "Route & parties",
      hint: "Who ships, who receives, how it travels and where it is delivered",
      icon: <Ship />,
      content: (
        <>
          {shipperField}
          {receiverField}
          {linerField}
          {polField}
          {podField}
          {chaField}
          {deliveryBlock}
        </>
      ),
    },
    {
      id: "details",
      label: "Details",
      hint: "Dossier, container, invoice and product information",
      icon: <FileText />,
      content: (
        <>
          {dossierField}
          {vaseField}
          {blField}
          {invoiceField}
          {etaField}
          {statusField}
          {descriptionField}
          {productField}
        </>
      ),
    },
    {
      id: "goods",
      label: "Goods value",
      hint: "AGV and goods details",
      icon: <Calculator />,
      content: (
        <>
          {agvField}
          {cartonsField}
          {agvComposition}
          {tptBlock}
        </>
      ),
    },
    {
      id: "documents",
      label: "Documents",
      hint: "Tick each stage as the paperwork moves",
      icon: <CheckSquare />,
      content: docsBlock,
    },
    {
      id: "clearance",
      label: "Clearance",
      hint: "Bill of entry, agency and notes",
      icon: <Package />,
      content: clearanceFields,
    },
    {
      id: "financial",
      label: "Financial",
      hint: "Optional reference amounts and screenshot",
      icon: <Wallet />,
      content: financialBlock,
    },
  ];
  if (hideFinancial)
    sections.splice(
      sections.findIndex((x) => x.id === "financial"),
      1,
    );
  const jump = (id: string) =>
    document.getElementById(`${uid}-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div className="ship-sections" data-nav={stickyNav ? "sticky" : "static"}>
      <nav className="ship-nav" aria-label="Form sections">
        {sections.map((x) => (
          <button type="button" key={x.id} onClick={() => jump(x.id)}>
            {x.icon}
            {x.label}
          </button>
        ))}
      </nav>
      {sections.map((x) => (
        <section className="ship-section" id={`${uid}-${x.id}`} key={x.id} aria-label={x.label}>
          <header className="ship-section-head">
            <span className="ship-section-icon">{x.icon}</span>
            <div>
              <h3>{x.label}</h3>
              <p>{x.hint}</p>
            </div>
          </header>
          <div className="ship-grid">{x.content}</div>
        </section>
      ))}
    </div>
  );
}
export function ShipmentForm({
  open,
  onClose,
  onSave,
  shipment,
  tpt,
  extra,
}: {
  open: boolean;
  onClose: () => void;
  /** May be async. Returning or resolving to a message means nothing was saved: the pop-up stays open and shows it. */
  onSave: (v: Shipment) => unknown;
  shipment?: Shipment;
  tpt?: number | undefined;
  /** Extra content under the fields (Edit Shipment adds the payments), bound to the form being edited. */
  extra?: (form: Shipment, setForm: (value: Shipment) => void) => ReactNode;
}) {
  const [form, setForm] = useState<Shipment>(() => ({ ...empty, ...shipment }));
  const [error, setError] = useState("");
  const [warehouseError, setWarehouseError] = useState(false);
  const [saving, setSaving] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  // A payment row the user is still entering in the Payments section (see PendingPaymentContext).
  const pendingPayment = useRef<PendingPayment | null>(null);
  // The payment summary loads after the pop-up opens and may preselect the TPT mode on the source shipment.
  // Adopt it only while the form has no TPT choice yet, so a choice made here is never overwritten.
  const preMode = shipment?.tptMode;
  const prePartial = shipment?.tptPartial;
  useEffect(() => {
    if (preMode && !form.tptMode) {
      setForm((f) => (f.tptMode ? f : { ...f, tptMode: preMode, tptPartial: prePartial ?? "" }));
    }
  }, [preMode, prePartial, form.tptMode]);
  const receiver = useReceiverWarehouses(form.rcv);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !saving) onClose();
      }}
    >
      <DialogContent
        className="shipment-dialog p-0 gap-0 flex flex-col overflow-hidden"
        aria-describedby="shipment-description"
      >
        <div className="modal-top">
          <DialogTitle>{shipment ? "Edit Shipment" : "Add Shipment"}</DialogTitle>
          <DialogDescription id="shipment-description">
            Shipment details, clearance information and goods value.
          </DialogDescription>
        </div>
        <form
          noValidate
          className="flex flex-col min-h-0"
          onSubmit={async (e) => {
            e.preventDefault();
            if (saving) return;
            // A payment typed into the Payments section but not kept with ✓ would be dropped by this save:
            // stop, say so, and take the user to it.
            if (pendingPayment.current) {
              setError(PENDING_PAYMENT_MESSAGE);
              snackbar.error(PENDING_PAYMENT_MESSAGE);
              pendingPayment.current.focus();
              return;
            }
            if (!form.vase.trim() || !form.dos.trim()) {
              setError("Enter a container number and dossier number.");
              return;
            }
            const missingWarehouse = needsWarehouseChoice(form, receiver.list);
            setWarehouseError(missingWarehouse);
            if (missingWarehouse) {
              setError("Choose the delivery warehouse for this receiver.");
              const el = e.currentTarget;
              // After the field shows its error, bring it into view.
              window.setTimeout(() => {
                const field = el.querySelector<HTMLElement>(".ship-delivery .field");
                field?.scrollIntoView?.({ behavior: "smooth", block: "center" });
                field?.querySelector<HTMLElement>("input, button")?.focus({ preventScroll: true });
              }, 50);
              return;
            }
            setError("");
            setSaving(true);
            let problem: unknown;
            try {
              problem = await onSave(form);
            } catch {
              problem = "The shipment could not be saved. Please try again.";
            }
            setSaving(false);
            if (typeof problem === "string" && problem) {
              setError(problem);
              // The message sits below a long form.
              window.setTimeout(
                () => errorRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" }),
                50,
              );
              return;
            }
            onClose();
          }}
        >
          <div className="modal-body">
            <ShipmentFields
              form={form}
              setForm={setForm}
              tpt={tpt}
              warehouseError={warehouseError}
              receiver={receiver}
              layout="sections"
              // Financial section is hidden for now (add and edit); remove this prop to bring it back.
              hideFinancial
            />
            <PendingPaymentContext.Provider value={pendingPayment}>
              {extra?.(form, setForm)}
            </PendingPaymentContext.Provider>
            {error && (
              <p ref={errorRef} role="alert" className="text-destructive mt-4">
                {error}
              </p>
            )}
          </div>
          <div className="modal-footer">
            <span className="ship-summary">
              <em>
                AGV <strong>{money(form.agv)}</strong>
              </em>
              <small>Required fields are marked with *</small>
            </span>
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={receiver.loading || saving}>
              {saving ? "Saving…" : shipment ? "Save Changes" : "Save Shipment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
