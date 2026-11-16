import * as yup from "yup";
import type { Shipment } from "./fsc";

// Preview data: shipments created by non-admin roles that wait for an admin decision.
// There is no approval endpoint yet, so decisions only change this in-memory list.
export type PendingShipment = {
  id: string;
  vase: string;
  blNo: string;
  requestedBy: string;
  requestedRole: "Shipper" | "Receiver" | "CHA";
  /** Minutes before "now" when it was submitted. */
  submittedMinutesAgo: number;
  receiver: string;
  shipper: string;
  pol: string;
  pod: string;
  eta: string;
  description: string;
  agv: number;
  note?: string;
};

export const pendingSamples: PendingShipment[] = [
  {
    id: "pend-1",
    vase: "MSKU7731204",
    blNo: "MAEU240918773",
    requestedBy: "Arctic",
    requestedRole: "Shipper",
    submittedMinutesAgo: 25,
    receiver: "TFA",
    shipper: "Arctic",
    pol: "PL",
    pod: "BOM",
    eta: "2026-11-18",
    description: "Apple 100/110 - Gala",
    agv: 24850,
    note: "Priority load, reefer set at 1°C.",
  },
  {
    id: "pend-2",
    vase: "TGHU5528016",
    blNo: "HLCUBR2610447",
    requestedBy: "TFA",
    requestedRole: "Receiver",
    submittedMinutesAgo: 95,
    receiver: "TFA",
    shipper: "RD8",
    pol: "NZ",
    pod: "CHE",
    eta: "2026-11-24",
    description: "Kiwi 30 - Green",
    agv: 71200,
  },
  {
    id: "pend-3",
    vase: "CMAU4410957",
    blNo: "CMDUSH884120",
    requestedBy: "InterlinkShipping",
    requestedRole: "CHA",
    submittedMinutesAgo: 60 * 5,
    receiver: "GFF",
    shipper: "TFC",
    pol: "US",
    pod: "KOL",
    eta: "2026-11-29",
    description: "Pears 90 - Bartlett",
    agv: 19640,
    note: "Dossier number to follow from the importer.",
  },
  {
    id: "pend-4",
    vase: "OOLU8890341",
    blNo: "OOLU2670981",
    requestedBy: "Nargo",
    requestedRole: "Shipper",
    submittedMinutesAgo: 60 * 26,
    receiver: "GMF",
    shipper: "Nargo",
    pol: "US",
    pod: "DEL",
    eta: "2026-12-04",
    description: "Citrus - Navel",
    agv: 43380,
  },
  {
    id: "pend-5",
    vase: "EGSU3306712",
    blNo: "EGLV143300218",
    requestedBy: "GFF",
    requestedRole: "Receiver",
    submittedMinutesAgo: 60 * 50,
    receiver: "GFF",
    shipper: "FreshPack",
    pol: "BR",
    pod: "BOM",
    eta: "2026-12-09",
    description: "Grapes - Crimson",
    agv: 28110,
  },
];

export function timeAgo(minutes: number): string {
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${Math.round(minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** The row an approved request becomes in the Active shipments list. */
export function approvedShipment(p: PendingShipment): Shipment {
  return {
    vase: p.vase,
    vsub: p.blNo,
    status: "Shipment created",
    ssub: "",
    reference: "",
    rcv: p.receiver,
    eta: p.eta,
    dos: "",
    pol: p.pol,
    pod: p.pod,
    shp: p.shipper,
    desc: p.description,
    dsub: "",
    agv: String(p.agv),
    gsm: "0",
    gsmd: "",
    bull: "0",
    bulld: "",
    tp: "0",
    sw: "0",
    inv: "",
    containers: "1",
  };
}

export const REJECT_REASON_MAX = 300;
export const rejectSchema = yup.object({
  reason: yup
    .string()
    .trim()
    .required("Enter a reason so the sender knows what to fix.")
    .max(REJECT_REASON_MAX, `Reason must be ${REJECT_REASON_MAX} characters or fewer.`),
});
