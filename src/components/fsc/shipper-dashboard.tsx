import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Package, Truck, Wallet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
  type RectangleProps,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/common/form";
import { money, type Shipment } from "@/lib/fsc";
import { dropdownId } from "@/lib/shipment-create";
import {
  accountSplit,
  monthlyShipments,
  shipperKpis,
  statusCounts,
  upcomingArrivals,
  type MonthBar,
} from "@/lib/shipper-dashboard";
import { useShipperStatementQuery } from "@/store/api/shipper-account.api";
import { useMasterOptions } from "./receiver-directory";
import "./shipper-dashboard.css";

/**
 * The Shipper's dashboard (user request, 2026-11-16): the same card / panel layout as the Owner's, with
 * the shipper's own figures. Headline tiles, shipments by ETA month, where their money stands, their
 * shipments by status and the next arrivals. All figures come from pure helpers in shipper-dashboard.ts.
 */

const todayUtc = () => {
  const d = new Date();
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
};
const shortDate = (day: number) =>
  new Date(day).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export function ShipperDashboard({
  shipper,
  rows,
  onOpen,
  onShipments,
  onLedger,
}: {
  /** The signed-in shipper: `code` is their short code, matched against the shipper list. */
  shipper: { code: string; name: string };
  /** Every shipment the shipper can see (active and delivered). */
  rows: Shipment[];
  onOpen: (s: Shipment) => void;
  onShipments: () => void;
  onLedger: () => void;
}) {
  const [period, setPeriod] = useState("6");
  const today = todayUtc();
  const master = useMasterOptions();
  const shipperId = dropdownId(master, "shippers", shipper.code);
  const { data: statement } = useShipperStatementQuery(
    { shipperId: shipperId ?? "" },
    { skip: !shipperId },
  );
  const kpis = useMemo(() => shipperKpis(rows, today), [rows, today]);
  const months = useMemo(
    () => monthlyShipments(rows, today, Number(period)),
    [rows, today, period],
  );
  const byStatus = useMemo(() => statusCounts(rows), [rows]);
  const arrivals = useMemo(() => upcomingArrivals(rows, today), [rows, today]);
  const account = useMemo(() => accountSplit(rows, statement), [rows, statement]);
  const maxStatus = Math.max(1, ...byStatus.map((s) => s.count));

  const tiles = [
    {
      title: "Active shipments",
      value: String(kpis.active),
      sub: `/ ${kpis.total} total`,
      foot: kpis.total ? `${kpis.total - kpis.active} delivered so far` : "No shipments yet",
      icon: Package,
      tone: "",
      onClick: onShipments,
    },
    {
      title: "Arriving this week",
      value: String(kpis.arrivingThisWeek),
      sub: kpis.arrivingThisWeek === 1 ? "shipment" : "shipments",
      foot: "ETA in the next 7 days",
      icon: CalendarDays,
      tone: "amber",
      onClick: onShipments,
    },
    {
      title: "Ready for delivery",
      value: String(kpis.ready),
      sub: kpis.ready === 1 ? "shipment" : "shipments",
      foot: "Cleared and waiting for delivery",
      icon: Truck,
      tone: "green",
      onClick: onShipments,
    },
    {
      title: account.balance < 0 ? "Paid in advance" : "Balance to be paid",
      value: money(Math.abs(account.balance)),
      sub: "",
      foot:
        account.balance < 0 ? "More paid than charged so far" : "AGV less GSM, TPT and direct OX",
      icon: Wallet,
      tone: "",
      onClick: onLedger,
    },
  ];

  // Paid parts and the balance as shares of what was charged (of what was paid, when that is more).
  const parts = [
    { key: "gsm", label: "GSM paid", amount: account.gsm },
    { key: "tpt", label: "TPT used", amount: account.tpt },
    { key: "ox", label: "Direct OX paid", amount: account.ox },
    { key: "due", label: "Balance to be paid", amount: Math.max(0, account.balance) },
  ];
  const whole = Math.max(account.charges, account.gsm + account.tpt + account.ox);

  return (
    <div className="sd">
      <div className="metric-grid">
        {tiles.map((t) => (
          <button type="button" className="metric-card sd-kpi" key={t.title} onClick={t.onClick}>
            <div className="metric-top">
              <span>{t.title}</span>
              <div className={`metric-icon ${t.tone}`}>
                <t.icon size={16} />
              </div>
            </div>
            <b>
              {t.value} {t.sub && <small>{t.sub}</small>}
            </b>
            <div className="metric-foot">{t.foot}</div>
          </button>
        ))}
      </div>

      <div className="sd-row sd-row-main">
        <section className="panel sd-panel" aria-labelledby="sd-months">
          <div className="panel-header">
            <div>
              <h2 id="sd-months">Shipments by month</h2>
              <p>By ETA month, including the next two months</p>
            </div>
            <SearchableSelect
              trigger="button"
              ariaLabel="Chart period"
              options={[
                { value: "6", label: "6 months" },
                { value: "12", label: "12 months" },
              ]}
              value={period}
              onChange={setPeriod}
            />
          </div>
          <div className="sd-legend" aria-hidden="true">
            <span>
              <i className="sd-swatch sd-c-progress" />
              In progress
            </span>
            <span>
              <i className="sd-swatch sd-c-delivered" />
              Delivered
            </span>
          </div>
          <div className="sd-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={months}
                barSize={22}
                margin={{ top: 20, right: 8, bottom: 0, left: -20 }}
              >
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  dy={6}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={<MonthTip />} />
                <Bar
                  dataKey="delivered"
                  name="Delivered"
                  stackId="s"
                  fill="var(--sd-delivered)"
                  stroke="var(--card)"
                  strokeWidth={2}
                  // Rounded top only when it is the column's top segment (nothing in progress).
                  shape={DeliveredShape}
                />
                <Bar
                  dataKey="inProgress"
                  name="In progress"
                  stackId="s"
                  fill="var(--sd-progress)"
                  stroke="var(--card)"
                  strokeWidth={2}
                  radius={[4, 4, 0, 0]}
                  label={<TotalLabel bars={months} />}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Screen readers only. A table cannot shrink below its content, so the clipping wrapper is a
              div: an sr-only table itself overflowed the page sideways. */}
          <div className="sr-only">
            <table>
              <caption>Shipments by ETA month</caption>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>In progress</th>
                  <th>Delivered</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.key}>
                    <td>{m.label}</td>
                    <td>{m.inProgress}</td>
                    <td>{m.delivered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel sd-panel sd-account" aria-labelledby="sd-account">
          <div className="panel-header">
            <div>
              <h2 id="sd-account">Account</h2>
              <p>AGV charged on your containers and how it has been paid</p>
            </div>
          </div>
          <div className="sd-account-body">
            <div className="sd-hero">
              <span>{account.balance < 0 ? "Paid in advance" : "Balance to be paid"}</span>
              <strong>{money(Math.abs(account.balance))}</strong>
              <small>of {money(account.charges)} AGV charged</small>
            </div>
            <div className="sd-split" role="img" aria-label="How the AGV charged has been paid">
              {parts
                .filter((p) => p.amount > 0)
                .map((p) => (
                  <i
                    key={p.key}
                    className={`sd-c-${p.key}`}
                    style={{ width: `${(p.amount / (whole || 1)) * 100}%` }}
                  />
                ))}
            </div>
            <ul className="sd-split-list">
              {parts.map((p) => (
                <li key={p.key}>
                  <i className={`sd-swatch sd-c-${p.key}`} aria-hidden="true" />
                  <span>{p.label}</span>
                  <strong>{money(p.amount)}</strong>
                  <small>{pct(p.amount, whole)}%</small>
                </li>
              ))}
            </ul>
          </div>
          <div className="sd-panel-foot">
            <Button variant="link" size="sm" onClick={onLedger}>
              Open ledger
              <ArrowRight size={14} />
            </Button>
          </div>
        </section>
      </div>

      <div className="sd-row">
        <section className="panel sd-panel" aria-labelledby="sd-status">
          <div className="panel-header">
            <div>
              <h2 id="sd-status">
                Shipments by status <span className="count">{kpis.total}</span>
              </h2>
              <p>Where each of your shipments is in the workflow</p>
            </div>
          </div>
          {byStatus.length ? (
            <ul className="sd-meters">
              {byStatus.map((s) => (
                <li key={s.status}>
                  <span>{s.status}</span>
                  <div className="sd-meter" aria-hidden="true">
                    {/* Same colours as the chart: delivered aqua, every other stage in progress blue. */}
                    <i
                      className={s.status === "Delivered" ? "sd-c-delivered" : "sd-c-progress"}
                      style={{ width: `${(s.count / maxStatus) * 100}%` }}
                    />
                  </div>
                  <strong>{s.count}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sd-empty">No shipments yet.</p>
          )}
        </section>

        <section className="panel sd-panel" aria-labelledby="sd-arrivals">
          <div className="panel-header">
            <div>
              <h2 id="sd-arrivals">Upcoming arrivals</h2>
              <p>Your next shipments by ETA</p>
            </div>
            <Button variant="link" size="sm" onClick={onShipments}>
              View all
              <ArrowRight size={14} />
            </Button>
          </div>
          {arrivals.length ? (
            <ul className="sd-arrivals">
              {arrivals.map(({ shipment: s, day, inDays }) => (
                <li key={s.vase || `${s.dos}-${day}`}>
                  <button type="button" onClick={() => onOpen(s)}>
                    <span className="sd-arrival-main">
                      <strong>{s.vase || "—"}</strong>
                      <small>{[s.desc, s.pod].filter(Boolean).join(" · ") || s.status}</small>
                    </span>
                    <span className="sd-arrival-when">
                      <strong>{shortDate(day)}</strong>
                      <small className={inDays <= 7 ? "sd-soon" : ""}>
                        {inDays === 0 ? "Today" : inDays === 1 ? "Tomorrow" : `In ${inDays} days`}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sd-empty">No arrivals scheduled.</p>
          )}
        </section>
      </div>
    </div>
  );
}

/** A Delivered segment: rounded at the top only when it is the column's top (nothing in progress). */
function DeliveredShape(props: unknown) {
  const p = props as RectangleProps & { payload?: MonthBar };
  return <Rectangle {...p} radius={p.payload?.inProgress ? 0 : [4, 4, 0, 0]} />;
}

/** The month's total above its column; nothing for an empty month. */
function TotalLabel(props: {
  x?: number;
  y?: number;
  width?: number;
  index?: number;
  bars: MonthBar[];
}) {
  const { x = 0, y = 0, width = 0, index = 0, bars } = props;
  const bar = bars[index];
  const total = bar ? bar.delivered + bar.inProgress : 0;
  if (!total) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      textAnchor="middle"
      fontSize={11}
      fontWeight={600}
      fill="var(--foreground)"
    >
      {total}
    </text>
  );
}

function MonthTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; dataKey?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((t, p) => t + (p.value ?? 0), 0);
  return (
    <div className="sd-tip">
      <strong>{label}</strong>
      {[...payload].reverse().map((p) => (
        <p key={p.dataKey}>
          <i
            className={`sd-swatch ${p.dataKey === "delivered" ? "sd-c-delivered" : "sd-c-progress"}`}
          />
          {p.name}
          <b>{p.value}</b>
        </p>
      ))}
      <p className="sd-tip-total">
        Total
        <b>{total}</b>
      </p>
    </div>
  );
}
