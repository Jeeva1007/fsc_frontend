import { uid } from "@/lib/id";
/** Sample deals and blank forms shared by the Ledger and AccountantLedger screens. */
export type Deal = {
  id: string;
  description: string;
  containers: string;
  shipper: string;
  pi: string;
  value: string;
  adjustment: string;
  buy1: string;
  buy2: string;
  sellRate: string;
  due: string;
  finalPaid: boolean;
};
export const initialDeals: Deal[] = [
  {
    id: "d1",
    description: "Gala Apples",
    containers: "3",
    shipper: "Rob",
    pi: "4496 / 4555",
    value: "95256",
    adjustment: "0",
    buy1: "31752",
    buy2: "15876",
    sellRate: "10584",
    due: "2026-07-06",
    finalPaid: true,
  },
  {
    id: "d2",
    description: "Gala Apples",
    containers: "3",
    shipper: "Rob",
    pi: "000 / 4662",
    value: "83944",
    adjustment: "2950",
    buy1: "28802",
    buy2: "11695",
    sellRate: "10584",
    due: "2026-07-06",
    finalPaid: true,
  },
  {
    id: "d3",
    description: "Gala Apples",
    containers: "3",
    shipper: "Rob",
    pi: "4700",
    value: "87378",
    adjustment: "2181",
    buy1: "29571",
    buy2: "14118",
    sellRate: "10584",
    due: "2026-07-06",
    finalPaid: false,
  },
];
export const blankDeal = (): Deal => ({
  id: uid(),
  description: "",
  containers: "3",
  shipper: "",
  pi: "",
  value: "",
  adjustment: "0",
  buy1: "",
  buy2: "",
  sellRate: "10584",
  due: "",
  finalPaid: false,
});
export const blankEntry = {
  shipper: "",
  file: "",
  eta: "",
  description: "",
  agv: "",
  amount: "",
  currency: "USD",
  date: "",
  via: "KAM",
  reference: "",
  notes: "",
};
