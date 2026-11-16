import type {
  ReserveBalanceArgs,
  TptEntryResponse,
  TptReserveBalanceResponse,
  TptTransferRequest,
} from "@/types/api";
import { baseApi } from "./baseApi";

/**
 * tpt-reserve endpoints (local Swagger, 2026-11-12). Tag: 'Ledger'.
 *   POST /tptReserve/addEntry      -> 201 the saved transfer + running balance
 *   GET  /tptReserve/reserveBalance?shipperId&shipmentId -> a shipper's current TPT reserve balance
 * baseApi unwraps the { success, message, data } envelope, so each endpoint gets its `data`.
 */
export const tptReserveApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    addTptEntry: build.mutation<TptEntryResponse, TptTransferRequest>({
      query: (body) => ({ url: "/tptReserve/addEntry", method: "POST", body }),
      invalidatesTags: ["Ledger"],
    }),
    reserveBalance: build.query<TptReserveBalanceResponse, ReserveBalanceArgs>({
      query: (args) => ({ url: "/tptReserve/reserveBalance", params: { ...args } }),
      providesTags: ["Ledger"],
    }),
  }),
});

export const { useAddTptEntryMutation, useReserveBalanceQuery } = tptReserveApi;
