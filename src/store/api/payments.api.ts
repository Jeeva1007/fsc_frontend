import type {
  PaymentBody,
  PaymentRecord,
  PaymentSide,
  ReversalBody,
  ShipmentCreated,
} from "@/types/api";
import { baseApi } from "./baseApi";

/** Ids are integers on the backend; reject anything else so a value can never alter the URL path. */
const safeId = (id: number, what: string) => {
  if (!Number.isSafeInteger(id) || id < 0) throw new Error(`Invalid ${what} id`);
  return id;
};
const paymentsPath = (shipmentId: number, paymentId?: number, suffix = "") =>
  `/shipments/${safeId(shipmentId, "shipment")}/payments` +
  (paymentId === undefined ? "" : `/${safeId(paymentId, "payment")}${suffix}`);

/**
 * payment-controller + file-controller endpoints (from /v3/api-docs). Tag: 'Payment' (one per shipment).
 * There is no DELETE: removing a payment is a reversal (POST .../reversal) that keeps the audit trail.
 */
export const paymentsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // GET /shipments/{id}/payments: the payments section. The spec types it as a free-form object.
    listPayments: build.query<Record<string, unknown>, number>({
      query: (shipmentId) => paymentsPath(shipmentId),
      providesTags: (_r, _e, shipmentId) => [{ type: "Payment", id: shipmentId }],
    }),
    // POST /shipments/{id}/payments -> { id }
    addPayment: build.mutation<ShipmentCreated, { shipmentId: number; body: PaymentBody }>({
      query: ({ shipmentId, body }) => ({ url: paymentsPath(shipmentId), method: "POST", body }),
      invalidatesTags: (_r, _e, { shipmentId }) => [
        { type: "Payment", id: shipmentId },
        { type: "Shipment", id: shipmentId },
      ],
    }),
    // PUT /shipments/{id}/payments/{paymentId}
    updatePayment: build.mutation<
      PaymentRecord,
      { shipmentId: number; paymentId: number; body: PaymentSide }
    >({
      query: ({ shipmentId, paymentId, body }) => ({
        url: paymentsPath(shipmentId, paymentId),
        method: "PUT",
        body,
      }),
      invalidatesTags: (_r, _e, { shipmentId }) => [
        { type: "Payment", id: shipmentId },
        { type: "Shipment", id: shipmentId },
      ],
    }),
    // POST /shipments/{id}/payments/{paymentId}/reversal -> { id }: this is how a payment is "deleted".
    reversePayment: build.mutation<
      ShipmentCreated,
      { shipmentId: number; paymentId: number; body?: ReversalBody }
    >({
      query: ({ shipmentId, paymentId, body }) => ({
        url: paymentsPath(shipmentId, paymentId, "/reversal"),
        method: "POST",
        body: body ?? {},
      }),
      invalidatesTags: (_r, _e, { shipmentId }) => [
        { type: "Payment", id: shipmentId },
        { type: "Shipment", id: shipmentId },
      ],
    }),
  }),
});

export const {
  useListPaymentsQuery,
  useAddPaymentMutation,
  useUpdatePaymentMutation,
  useReversePaymentMutation,
} = paymentsApi;
