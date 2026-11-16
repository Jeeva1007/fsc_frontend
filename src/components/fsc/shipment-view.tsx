import type { ReactNode } from "react";
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  CheckSquare,
  Circle,
  FileText,
  Package,
  Ship,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import {
  agvTotal,
  DEFAULT_UNIT,
  money,
  stageCheckboxes,
  type CostLine,
  type Shipment,
} from "@/lib/fsc";
import { displayDate, parseIsoDate } from "@/lib/date-value";
import { shownDelivery } from "@/lib/receiver-warehouses";
import { Button } from "@/components/ui/button";
import { useMasterOptions, useReceiverWarehouses } from "./receiver-directory";
import { isEnhancementAgency } from "@/lib/shipment-list";
import { agencyLabel, agencyOptions } from "@/lib/master-choices";

/** ISO dates are shown like the rest of the app; anything else (e.g. "29/May/26") is shown as stored. */
const date = (v: string | undefined) => {
  const d = parseIsoDate(v);
  return d ? displayDate(d) : v || "";
};
const amount = (v: string | number | undefined) =>
  v === undefined || v === "" || v === null ? "" : money(v);

/** One label / value pair. Empty values show a muted dash so the grid keeps its shape. */
function Item({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  const empty = value === undefined || value === null || value === "";
  return (
    <div className={wide ? "sv-item sv-wide" : "sv-item"}>
      <dt>{label}</dt>
      <dd className={empty ? "sv-empty" : undefined}>{empty ? "—" : value}</dd>
    </div>
  );
}

function Section({
  icon,
  title,
  hint,
  wide,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={wide ? "sv-card sv-span" : "sv-card"} aria-label={title}>
      <header className="sv-card-head">
        <span className="sv-card-icon" aria-hidden="true">
          {icon}
        </span>
        <div>
          <h3>{title}</h3>
          <p>{hint}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function LinesTable({ lines }: { lines: CostLine[] }) {
  return (
    <table className="sv-lines">
      <thead>
        <tr>
          <th>Product description</th>
          <th className="num">Quantity</th>
          <th className="num">Unit price</th>
          <th className="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.id}>
            <td>{l.product || "—"}</td>
            <td className="num">
              {l.quantity ? (
                <>
                  {l.quantity} <span className="sv-unit">{l.unit || DEFAULT_UNIT}</span>
                </>
              ) : (
                "—"
              )}
            </td>
            <td className="num">{amount(l.cost) || "—"}</td>
            <td className="num">{money((Number(l.quantity) || 0) * (Number(l.cost) || 0))}</td>
          </tr>
        ))}
        {lines.length === 0 && (
          <tr>
            <td colSpan={4} className="empty-state">
              No data found
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/**
 * Read-only shipment overview: the same fields as Add / Edit Shipment, shown as text. Editing happens
 * only in the Edit Shipment pop-up.
 */
export function ShipmentView({ shipment: s, tpt }: { shipment: Shipment; tpt?: number }) {
  const lines = s.breakdown ?? [];
  const warehouses = useReceiverWarehouses(s.rcv);
  const delivery = shownDelivery(s, warehouses.list);
  const hasDelivery = Boolean(delivery.warehouse || delivery.warehouseWhatsapp);
  const agencies = s.agency?.split(", ").filter(Boolean) ?? [];
  const master = useMasterOptions();
  const agencyList = agencyOptions(master);
  const docsDone = stageCheckboxes.filter((x) => s[x.key]).length;
  return (
    <div className="sv">
      <div className="sv-hero" aria-label="Shipment summary">
        <div className="sv-route">
          <span>Route</span>
          <strong>
            {s.pol || "—"} <ArrowRight size={16} aria-label="to" /> {s.pod || "—"}
          </strong>
        </div>
        <div>
          <span>Shipper → Receiver</span>
          <strong>
            {s.shp || "—"} <ArrowRight size={14} aria-label="to" /> {s.rcv || "—"}
          </strong>
        </div>
        <div>
          <span>ETA</span>
          <strong>{date(s.eta) || "—"}</strong>
        </div>
        <div>
          <span>AGV</span>
          <strong>{money(s.agv)}</strong>
        </div>
      </div>
      <div className="sv-grid">
        <Section
          icon={<Ship />}
          title="Route & parties"
          hint="Who ships, who receives and how it travels"
        >
          <dl className="sv-list">
            <Item label="Shipper" value={s.shp} />
            <Item label="Receiver" value={s.rcv} />
            <Item label="Liner" value={s.liner} />
            <Item label="POL" value={s.pol} />
            <Item label="POD" value={s.pod} />
            <Item label="CHA" value={s.cha} />
          </dl>
        </Section>
        <Section icon={<FileText />} title="Details" hint="Dossier, container, invoice and product">
          <dl className="sv-list">
            <Item label="Dossier No" value={s.dos} />
            <Item label="Vase / Container No" value={s.vase} />
            <Item label="BL No" value={s.vsub} />
            <Item label="Sales Invoice No" value={s.inv} />
            <Item label="ETA" value={date(s.eta)} />
            <Item label="Status" value={s.status} />
            <Item label="Product" value={s.chaDescription} />
            <Item label="Product Description" value={s.desc} />
          </dl>
        </Section>
        <Section
          wide
          icon={<WarehouseIcon />}
          title="Delivery warehouse"
          hint={
            s.rcv ? `Where ${s.rcv} receives this shipment` : "Where this shipment is delivered"
          }
        >
          {warehouses.loading ? (
            <p className="sv-note" role="status">
              Loading warehouses…
            </p>
          ) : (
            <>
              {hasDelivery ? (
                <dl className="sv-list sv-list-3">
                  <Item label="Warehouse" value={delivery.warehouse} />
                  <Item label="Location" value={delivery.warehouseLocation} />
                  <Item label="WhatsApp" value={delivery.warehouseWhatsapp} />
                </dl>
              ) : (
                !warehouses.error && (
                  <p className="sv-note">
                    {!s.rcv
                      ? "No receiver selected yet."
                      : warehouses.list.length > 1
                        ? `Not chosen yet. This receiver has ${warehouses.list.length} warehouses; use “Edit Shipment” to choose one.`
                        : "No warehouse saved for this receiver."}
                  </p>
                )
              )}
              {warehouses.error && (
                <div className="sv-note sv-note-error" role="alert">
                  <span>Warehouses could not be loaded. {warehouses.error}</span>
                  <Button type="button" size="sm" variant="outline" onClick={warehouses.retry}>
                    Try again
                  </Button>
                </div>
              )}
            </>
          )}
        </Section>
        <Section wide icon={<Calculator />} title="Goods value" hint="AGV and composition">
          <dl className="sv-list sv-list-4">
            <Item label="AGV" value={amount(s.agv)} />
            <Item label="No. of Cartons" value={s.cartons} />
            {s.shp === "Rob" && tpt !== undefined && (
              <Item label="TPT Transfer (Rob ledger)" value={money(tpt)} />
            )}
          </dl>
          {lines.length > 0 && (
            <div className="sv-composition">
              <h4>
                AGV composition <span className="count">{lines.length} items</span>
              </h4>
              <LinesTable lines={lines} />
              <div className="sv-total">
                <span>Total goods value</span>
                <strong>{money(agvTotal(lines))}</strong>
              </div>
            </div>
          )}
        </Section>
        <Section
          icon={<CheckSquare />}
          title="Documents"
          hint={`${docsDone} of ${stageCheckboxes.length} stages done`}
        >
          <ul className="sv-docs">
            {stageCheckboxes.map((x) => {
              const done = Boolean(s[x.key]);
              return (
                <li key={x.key} className={done ? "done" : undefined}>
                  {done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  <span>{x.label}</span>
                  <em>{done ? "Done" : "Pending"}</em>
                </li>
              );
            })}
          </ul>
        </Section>
        <Section icon={<Package />} title="Clearance" hint="Bill of entry, agency and notes">
          <dl className="sv-list">
            <Item label="BE No" value={s.be} />
            <Item label="BE Date" value={date(s.beDate)} />
            <Item label="BE Type" value={s.beType} />
            <Item
              label="Agency"
              value={
                agencies.length ? (
                  <span className="sv-chips">
                    {agencies.map((a) => (
                      <span key={a}>{agencyLabel(a, agencyList)}</span>
                    ))}
                  </span>
                ) : (
                  ""
                )
              }
            />
            {agencies.some((a) => isEnhancementAgency(a, master)) && (
              <Item label="Enhancement amount" value={amount(s.enhancement)} />
            )}
            <Item label="Status Note" value={s.note} wide />
          </dl>
        </Section>
      </div>
    </div>
  );
}
