import type {
  ShipperAccountContainerResponse,
  ShipperAccountStatementArgs,
  ShipperAccountStatementResponse,
  ShipperAccountSummaryResponse,
} from "@/types/api";
import { baseApi } from "./baseApi";

/**
 * shipper-account endpoints (local Swagger). Both take the shipper's UUID as `shipperId`.
 *   GET /shipperAccount/statement?shipperId=&fromDate=&toDate=
 *        -> entries in date order with the running balance (Statements tab · Design B).
 *   GET /shipperAccount/containers?shipperId=
 *        -> each container's AGV, GSM advance, net after advance and advance % (Containers tab · Design B).
 *   GET /shipperAccount/summary?shipperId=
 *        -> the account's summary tiles: container count, total AGV, GSM, transfers, TPT used, balances.
 * baseApi unwraps the { success, message, data } envelope, so each endpoint receives `data`.
 */
export const shipperAccountApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    shipperStatement: build.query<ShipperAccountStatementResponse, ShipperAccountStatementArgs>({
      query: ({ shipperId, fromDate, toDate }) => ({
        url: "/shipperAccount/statement",
        params: {
          shipperId,
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
        },
      }),
      providesTags: ["Ledger"],
    }),
    shipperSummary: build.query<ShipperAccountSummaryResponse, string>({
      query: (shipperId) => ({ url: "/shipperAccount/summary", params: { shipperId } }),
      providesTags: ["Ledger"],
    }),
    shipperContainers: build.query<ShipperAccountContainerResponse[], string>({
      query: (shipperId) => ({ url: "/shipperAccount/containers", params: { shipperId } }),
      transformResponse: (rows: unknown) =>
        Array.isArray(rows) ? (rows as ShipperAccountContainerResponse[]) : [],
      providesTags: ["Ledger"],
    }),
  }),
});

export const { useShipperStatementQuery, useShipperContainersQuery, useShipperSummaryQuery } =
  shipperAccountApi;
