import type {
  ShipmentPaymentRequest,
  ShipmentPaymentResponse,
  ShipmentPaymentSummaryResponse,
} from "@/types/api";
import { baseApi } from "./baseApi";

/**
 * shipment-payments endpoints (local Swagger, 2026-11-12). Tag: 'Payment'.
 *   GET    /shipmentPayments/paymentSummary?shipmentId -> rows + AGV/totals + TPT reserve balance
 *   PUT    /shipmentPayments/updatePayment   body: row[] (id = update, no id = create) -> saved rows
 *   DELETE /shipmentPayments/deletePayment?ids=... (TPT reserve the rows used is given back)
 * updatePayment is the single save endpoint (it both creates and updates); createPayment is unused.
 * baseApi unwraps the { success, message, data } envelope, so each endpoint gets its `data`.
 */
export const shipmentPaymentsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    paymentSummary: build.query<ShipmentPaymentSummaryResponse, string>({
      query: (shipmentId) => ({ url: "/shipmentPayments/paymentSummary", params: { shipmentId } }),
      providesTags: ["Payment"],
    }),
    updatePayments: build.mutation<ShipmentPaymentResponse[], ShipmentPaymentRequest[]>({
      query: (body) => ({ url: "/shipmentPayments/updatePayment", method: "PUT", body }),
      invalidatesTags: ["Payment", "Ledger"],
    }),
    deletePayments: build.mutation<void, string[]>({
      query: (ids) => ({
        url: "/shipmentPayments/deletePayment",
        method: "DELETE",
        params: { ids },
        responseHandler: "content-type",
      }),
      invalidatesTags: ["Payment", "Ledger"],
    }),
  }),
});

export const { usePaymentSummaryQuery, useUpdatePaymentsMutation, useDeletePaymentsMutation } =
  shipmentPaymentsApi;
