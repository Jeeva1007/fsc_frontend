import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowRight, Clock3, Package, Wallet } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/common/form";
import { money } from "@/lib/fsc";
import {
  closureCounts,
  mainCurrency,
  paidByMonth,
  paidByShipper,
  paidSummary,
  paymentStatusCounts,
  recentAdvices,
  type Count,
  type PaidMonth,
} from "@/lib/accountant-dashboard";
import { shownPaymentStatus } from "@/lib/debit-advice";
import { fromGsmOxLedgerResponse } from "@/lib/debit-advice-api";
import { useLedgerCardsQuery, useListLedgersQuery } from "@/store/api/ledger.api";
import "./shipper-dashboard.css";

/**
 * The Accountant's dashboard (user request, 2026-11-16): the same card / panel layout as the Owner's and
 * the Shipper's, built on the GSM - OX Deal Ledger. Headline totals from GET /gsmOxLedger/cards; the
 * charts and lists from the latest ledger entries (GET /gsmOxLedger/ledgerList), worked out by the pure
 * helpers in accountant-dashboard.ts. Styles are shared with the Shipper dashboard (.sd).
 */

/** Entries the dashboard reads; the register itself stays paged at 10. */
const DASHBOARD_ENTRIES = 100;

const todayUtc = () => {
  const d = new Date();
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
};
const shortDate = (day: number | undefined) =>
  day === undefined
    ? "No date"
    : new Date(day).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
/** 12450 -> "12.5k", for labels above columns; tooltips and lists keep the full amount. */
const compact = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1000
      ? `${(n / 1000).toFixed(1)}k`
      : `${Math.round(n)}`;
const amountOrDash = (n: number | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? money(n) : "—";

export function AccountantDashboard({ onLedger }: { onLedger: () => void }) {
  const [period, setPeriod] = useState("12");
  const today = todayUtc();
  const { data: cards } = useLedgerCardsQuery();
  const { data: page } = useListLedgersQuery({ page: 0, size: DASHBOARD_ENTRIES });
  const advices = useMemo(() => (page?.items ?? []).map(fromGsmOxLedgerResponse), [page]);
  const partial = (page?.total ?? 0) > advices.length;
  const currency = useMemo(() => mainCurrency(advices), [advices]);
  const months = useMemo(
    () => paidByMonth(advices, currency, today, Number(period)),
    [advices, currency, today, period],
  );
  const summary = useMemo(() => paidSummary(months), [months]);
  const shippers = useMemo(() => paidByShipper(advices, currency), [advices, currency]);
  const statuses = useMemo(() => paymentStatusCounts(advices), [advices]);
  const closures = useMemo(() => closureCounts(advices), [advices]);
  const recent = useMemo(() => recentAdvices(advices), [advices]);
  const maxShipper = Math.max(1, ...shippers.map((s) => s.amount));
  const scope = partial ? `the latest ${advices.length} entries` : "all entries";

  const deals = cards?.dealCount;
  const containers = cards?.containerCount;
  const tiles = [
    {
      title: "Total purchase",
      value: amountOrDash(cards?.totalPurchase),
      foot:
        deals !== undefined || containers !== undefined
          ? `${deals ?? 0} ${deals === 1 ? "deal" : "deals"} · ${containers ?? 0} ${containers === 1 ? "container" : "containers"}`
          : "Deals and containers",
      icon: Package,
      tone: "",
    },
    {
      title: "Paid to shippers",
      value: amountOrDash(cards?.paidToShippers),
      foot: "Sent to shippers so far",
      icon: Wallet,
      tone: "green",
    },
    {
      title: "Due to shippers",
      value: amountOrDash(cards?.dueToShippers),
      foot: "Still to be paid out",
      icon: Clock3,
      tone: "amber",
    },
    {
      title: "Due from OX",
      value: amountOrDash(cards?.dueFromOx),
      foot: "Still to be received from OX",
      icon: ArrowDownLeft,
      tone: "",
    },
  ];

  return (
    <div className="sd">
      <div className="metric-grid">
        {tiles.map((t) => (
          <button type="button" className="metric-card sd-kpi" key={t.title} onClick={onLedger}>
            <div className="metric-top">
              <span>{t.title}</span>
              <div className={`metric-icon ${t.tone}`}>
                <t.icon size={16} />
              </div>
            </div>
            <b>{t.value}</b>
            <div className="metric-foot">{t.foot}</div>
          </button>
        ))}
      </div>

      <div className="sd-row sd-row-main">
        <section className="panel sd-panel" aria-labelledby="ad-months">
          <div className="panel-header">
            <div>
              <h2 id="ad-months">Paid to shippers</h2>
              <p>By the date paid on BE lines · {scope}</p>
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
          {/* The period at a glance, above its trend (user request, 2026-11-16). */}
          <dl className="ad-summary">
            <div>
              <dt>Total paid</dt>
              <dd>
                {money(summary.total)} <small>{currency}</small>
              </dd>
              <span>
                {summary.lines} BE {summary.lines === 1 ? "line" : "lines"} in {period} months
              </span>
            </div>
            <div>
              <dt>This month</dt>
              <dd>{money(summary.current)}</dd>
              <span>Last month {money(summary.previous)}</span>
            </div>
            <div>
              <dt>vs last month</dt>
              <dd>
                {summary.change === null ? (
                  "—"
                ) : (
                  <>
                    <span className="ad-arrow" aria-hidden="true">
                      {summary.change > 0 ? "▲" : summary.change < 0 ? "▼" : "•"}
                    </span>{" "}
                    {Math.abs(summary.change)}%
                  </>
                )}
              </dd>
              <span>
                {summary.change === null
                  ? "Nothing paid last month"
                  : summary.change > 0
                    ? "More paid than last month"
                    : summary.change < 0
                      ? "Less paid than last month"
                      : "Same as last month"}
              </span>
            </div>
          </dl>
          <div className="sd-chart ad-trend">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={months} margin={{ top: 12, right: 16, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="ad-paid-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--sd-progress)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--sd-progress)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  dy={6}
                  interval="preserveStartEnd"
                  minTickGap={12}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  tickFormatter={compact}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
                  content={<PaidTip currency={currency} />}
                />
                <Area
                  type="monotone"
                  dataKey="paid"
                  name="Paid"
                  stroke="var(--sd-progress)"
                  strokeWidth={2}
                  fill="url(#ad-paid-fill)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    stroke: "var(--card)",
                    strokeWidth: 2,
                    fill: "var(--sd-progress)",
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Screen readers only; the clipping wrapper is a div (a table cannot shrink below its content). */}
          <div className="sr-only">
            <table>
              <caption>Paid to shippers by month, {currency}</caption>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Paid</th>
                  <th>BE lines</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.key}>
                    <td>{m.label}</td>
                    <td>{money(m.paid)}</td>
                    <td>{m.lines}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel sd-panel" aria-labelledby="ad-recon">
          <div className="panel-header">
            <div>
              <h2 id="ad-recon">Reconciliation</h2>
              <p>Payment status of entries and BE closure of lines · {scope}</p>
            </div>
          </div>
          {advices.length ? (
            <div className="ad-groups">
              <MeterGroup title="Payment status" unit="entries" rows={statuses} />
              <MeterGroup title="BE closure" unit="BE lines" rows={closures} />
            </div>
          ) : (
            <p className="sd-empty">No ledger entries yet.</p>
          )}
        </section>
      </div>

      <div className="sd-row">
        <section className="panel sd-panel" aria-labelledby="ad-shippers">
          <div className="panel-header">
            <div>
              <h2 id="ad-shippers">Paid by shipper</h2>
              <p>
                {currency} paid to each shipper, largest first · {scope}
              </p>
            </div>
          </div>
          {shippers.length ? (
            <ul className="sd-meters ad-ranked">
              {shippers.map((s) => (
                <li key={s.name}>
                  <span title={s.name}>{s.name}</span>
                  <div className="sd-meter" aria-hidden="true">
                    {/* "Other" is the folded tail, not one shipper: grey, so it never reads as the top. */}
                    <i
                      className={s.name.startsWith("Other (") ? "sd-c-due" : "sd-c-progress"}
                      style={{ width: `${(s.amount / maxShipper) * 100}%` }}
                    />
                  </div>
                  <strong>{money(s.amount)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sd-empty">No payments to shippers yet.</p>
          )}
        </section>

        <section className="panel sd-panel" aria-labelledby="ad-recent">
          <div className="panel-header">
            <div>
              <h2 id="ad-recent">Latest entries</h2>
              <p>The most recent GSM - OX ledger entries</p>
            </div>
            <Button variant="link" size="sm" onClick={onLedger}>
              Open ledger
              <ArrowRight size={14} />
            </Button>
          </div>
          {recent.length ? (
            <ul className="sd-arrivals">
              {recent.map(({ advice: a, day, value }) => (
                <li key={a.id}>
                  <button type="button" onClick={onLedger}>
                    <span className="sd-arrival-main">
                      <strong>{a.partyName || "No party"}</strong>
                      <small>
                        {[a.reference, a.billNo, shownPaymentStatus(a)]
                          .filter(Boolean)
                          .join(" · ") || "No reference"}
                      </small>
                    </span>
                    <span className="sd-arrival-when">
                      <strong>
                        {money(value)} {a.curr}
                      </strong>
                      <small>{shortDate(day)}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sd-empty">No ledger entries yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}

/** A titled list of meters: one bar per row, scaled to the largest, with its count. */
function MeterGroup({ title, unit, rows }: { title: string; unit: string; rows: Count[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((t, r) => t + r.count, 0);
  return (
    <div className="ad-group">
      <h3>
        {title}
        <small>
          {total} {unit}
        </small>
      </h3>
      <ul className="sd-meters">
        {rows.map((r) => (
          <li key={r.label}>
            <span>{r.label}</span>
            <div className="sd-meter" aria-hidden="true">
              <i className="sd-c-progress" style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
            <strong>{r.count}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PaidTip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: { payload?: PaidMonth }[];
  label?: string;
  currency: string;
}) {
  const m = payload?.[0]?.payload;
  if (!active || !m) return null;
  return (
    <div className="sd-tip">
      <strong>{label}</strong>
      <p>
        <i className="sd-swatch sd-c-progress" />
        Paid
        <b>
          {money(m.paid)} {currency}
        </b>
      </p>
      <p>
        BE lines
        <b>{m.lines}</b>
      </p>
    </div>
  );
}
