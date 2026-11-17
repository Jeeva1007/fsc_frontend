import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Package,
  Truck,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/common/form";
import { ShipmentsTable } from "./shipments";
import { PendingShipments } from "./pending-shipments";
import type { PendingShipment } from "@/lib/pending-shipments";
import { ChaDashboard } from "./cha-dashboard";
import { ShipperDashboard } from "./shipper-dashboard";
import { AccountantDashboard } from "./accountant-dashboard";
import { type Role, type Shipment } from "@/lib/fsc";
const chart = [
  { month: "Nov", delivered: 11, active: 3, pending: 2 },
  { month: "Dec", delivered: 15, active: 10, pending: 5 },
  { month: "Jan", delivered: 4, active: 4, pending: 4 },
  { month: "Feb", delivered: 6, active: 1, pending: 0 },
  { month: "Mar", delivered: 10, active: 1, pending: 0 },
  { month: "Apr", delivered: 37, active: 1, pending: 0 },
  { month: "May", delivered: 29, active: 3, pending: 0 },
  { month: "Jun", delivered: 14, active: 3, pending: 2 },
  { month: "Jul", delivered: 4, active: 1, pending: 0 },
  { month: "Aug", delivered: 0, active: 0, pending: 0 },
  { month: "Sep", delivered: 0, active: 0, pending: 0 },
  { month: "Oct", delivered: 0, active: 0, pending: 0 },
];
export function Dashboard({
  role,
  rows,
  onOpen,
  onShipments,
  onMaster,
  onEdit,
  shipper,
  shipperAccount,
  onLedger,
  masterRows = [],
  pending = [],
  onApprove,
  onReject,
}: {
  role: Role;
  rows: Shipment[];
  shipper?: boolean;
  /** The signed-in shipper (Shipper role): their account loads the dashboard's money figures. */
  shipperAccount?: { code: string; name: string } | undefined;
  /** Opens the Ledger screen (the Shipper dashboard's balance links there). */
  onLedger?: () => void;
  masterRows?: Shipment[];
  /** Admin only: shipments created by other roles waiting for a decision. */
  pending?: PendingShipment[];
  onApprove?: (p: PendingShipment) => void;
  onReject?: (p: PendingShipment, reason: string) => void;
  onOpen: (s: Shipment) => void;
  onShipments: () => void;
  onMaster: () => void;
  onEdit?: (s: Shipment) => void;
}) {
  const [period, setPeriod] = useState("12");
  if (role === "cha")
    return <ChaDashboard rows={rows} masterRows={masterRows} onShipments={onShipments} />;
  if (role === "accountant") return <AccountantDashboard onLedger={onLedger ?? onShipments} />;
  if (shipper && shipperAccount)
    return (
      <ShipperDashboard
        shipper={shipperAccount}
        rows={[...rows, ...masterRows]}
        onOpen={onOpen}
        onShipments={onShipments}
        onLedger={onLedger ?? onShipments}
      />
    );
  const metrics = (
    <div className="metric-grid">
      {[
        {
          title: "Active shipments",
          value: role === "admin" ? "17" : "13",
          sub: role === "admin" ? "/ 169 total" : "/ 141 total",
          foot: "+10%",
          footText: "from last month",
          icon: Package,
          color: "",
        },
        {
          title: "Ready for delivery",
          value: rows.filter((x) => x.status === "Ready for Delivery").length,
          sub: "shipments",
          foot: "On track",
          footText: "for scheduled delivery",
          icon: Truck,
          color: "green",
        },
        {
          title: role === "admin" ? "Pending clearance" : "Next week ETA",
          value: role === "admin" ? "3" : "0",
          sub: role === "admin" ? "need assignment" : "arriving shipments",
          foot: role === "admin" ? "Action needed" : "No delays",
          footText: role === "admin" ? "clearance assignment" : "in upcoming arrivals",
          icon: FileCheck2,
          color: "amber",
        },
        {
          title: role === "admin" ? "Pending approvals" : "Following week ETA",
          value: role === "admin" ? String(pending.length) : "0",
          sub: role === "admin" ? "awaiting review" : "arriving shipments",
          foot: role === "admin" && pending.length ? "Action needed" : "All clear",
          footText: role === "admin" ? "everything is up to date" : "in 14–21 days",
          icon: Clock3,
          color: "",
        },
      ].map((item) => (
        <div className="metric-card" key={item.title}>
          <div className="metric-top">
            <span>{item.title}</span>
            <div className={`metric-icon ${item.color}`}>
              <item.icon size={16} />
            </div>
          </div>
          <b>
            {item.value} <small>{item.sub}</small>
          </b>
          <div className="metric-foot">
            <span className="flex items-center gap-1">
              <ArrowUpRight size={12} />
              {item.foot}
            </span>
            {item.footText}
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <>
      {metrics}
      <div className="overview-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Shipment overview</h2>
              <p>Monthly shipment activity across all ports</p>
            </div>
            <SearchableSelect
              trigger="button"
              ariaLabel="Chart period"
              options={[
                { value: "12", label: "Last 12 months" },
                { value: "6", label: "Last 6 months" },
              ]}
              value={period}
              onChange={setPeriod}
            />
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chart.slice(-Number(period))}
                barSize={14}
                margin={{ top: 12, right: 12, bottom: 0, left: -17 }}
              >
                <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 4" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} dy={7} />
                <YAxis axisLine={false} tickLine={false} ticks={[0, 10, 20, 30, 40]} />
                <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip />} />
                <Bar dataKey="delivered" stackId="a" fill="var(--chart-delivered)" />
                <Bar dataKey="active" stackId="a" fill="var(--chart-active)" />
                <Bar
                  dataKey="pending"
                  stackId="a"
                  fill="var(--chart-pending)"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            <span>
              <i />
              Delivered
            </span>
            <span>
              <i />
              Active
            </span>
            <span>
              <i />
              Pending
            </span>
          </div>
        </div>
        <div className="panel attention-panel">
          <div className="panel-header">
            <div>
              <h2>
                Needs your attention <span className="count">3</span>
              </h2>
              <p>Updates that matter to your shipments</p>
            </div>
          </div>
          {[
            {
              icon: FileCheck2,
              title: "Clearance assignment pending",
              text: "3 containers are waiting for a CHA assignment.",
              time: "Shipment operations",
              action: onShipments,
            },
            {
              icon: CircleDollarSign,
              title: "Payment follow-up",
              text: "Rob · GMF — final payment is due for review.",
              time: "Accounts & payments",
              action: role === "admin" ? onMaster : onShipments,
            },
            {
              icon: CalendarDays,
              title: "Upcoming arrivals",
              text: "Keep documents ready for the next port arrival.",
              time: "Schedule update",
              action: onShipments,
            },
          ].map((x) => (
            <div key={x.title} className="attention-item">
              <div className="attention-icon">
                <x.icon size={15} />
              </div>
              <div>
                <strong>{x.title}</strong>
                <p>{x.text}</p>
                <small>{x.time}</small>
              </div>
              <Button variant="ghost" size="icon" aria-label={x.title} onClick={x.action}>
                <ArrowRight size={14} />
              </Button>
            </div>
          ))}
        </div>
      </div>
      {role === "admin" && onApprove && onReject && (
        <PendingShipments items={pending} onApprove={onApprove} onReject={onReject} />
      )}
      <div className="section-heading">
        <h2>
          Recent shipments <span className="count">{rows.length}</span>
        </h2>
        <Button variant="link" size="sm" onClick={onShipments}>
          View all shipments
          <ArrowRight size={14} />
        </Button>
      </div>
      <ShipmentsTable
        rows={rows}
        onOpen={onOpen}
        onEdit={role === "admin" ? onEdit : undefined}
        compact
      />
    </>
  );
}
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number }[];
  label?: string;
}) {
  if (!active) return null;
  return (
    <div className="panel p-3 text-xs">
      <strong>{label}</strong>
      {payload?.map((x) => (
        <p className="mt-1 text-muted-foreground" key={x.name}>
          {x.name}: {x.value}
        </p>
      ))}
    </div>
  );
}
