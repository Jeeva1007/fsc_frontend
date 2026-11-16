import type {
  AgvLinesPayload,
  PageResult,
  ShipmentCreated,
  ShipmentPayload,
  ChecksPayload,
  ShipmentRecord,
  StagePayload,
} from "@/types/api";
import { baseApi } from "./baseApi";

/** Path ids are int32 on the backend; reject anything else so a value can never alter the URL path. */
const shipmentPath = (id: number, suffix = "") => {
  if (!Number.isSafeInteger(id) || id < 0) throw new Error("Invalid shipment id");
  return `/shipments/${id}${suffix}`;
};

/** shipment-controller endpoints. Tag: 'Shipment'. */
export const shipmentsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // GET /listing (the shipment list) was removed (user request, 2026-11-10).
    // GET /shipments?search=: quick search (listing-controller). `search` is required by the API.
    searchShipments: build.query<PageResult, string>({
      query: (search) => ({ url: "/shipments", params: { search } }),
      providesTags: ["Shipment"],
    }),
    // POST /shipments -> { id }
    createShipment: build.mutation<ShipmentCreated, ShipmentPayload>({
      query: (body) => ({ url: "/shipments", method: "POST", body }),
      invalidatesTags: ["Shipment"],
    }),
    // GET /shipments/{id}
    getShipment: build.query<ShipmentRecord, number>({
      query: (id) => shipmentPath(id),
      providesTags: (_result, _error, id) => [{ type: "Shipment", id }],
    }),
    // PUT /shipments/{id}
    updateShipment: build.mutation<ShipmentRecord, { id: number; body: ShipmentPayload }>({
      query: ({ id, body }) => ({ url: shipmentPath(id), method: "PUT", body }),
      invalidatesTags: (_result, _error, { id }) => ["Shipment", { type: "Shipment", id }],
    }),
    // PUT /shipments/{id}/checks: the four document-stage checkboxes.
    updateChecks: build.mutation<ShipmentRecord, { id: number; body: ChecksPayload }>({
      query: ({ id, body }) => ({ url: shipmentPath(id, "/checks"), method: "PUT", body }),
      invalidatesTags: (_result, _error, { id }) => ["Shipment", { type: "Shipment", id }],
    }),
    // PUT /shipments/{id}/stage: moves the shipment to a workflow stage (its "status").
    updateStage: build.mutation<ShipmentRecord, { id: number; body: StagePayload }>({
      query: ({ id, body }) => ({ url: shipmentPath(id, "/stage"), method: "PUT", body }),
      invalidatesTags: (_result, _error, { id }) => ["Shipment", { type: "Shipment", id }],
    }),
    // GET /stages was removed (user request, 2026-11-10); a status change sends no stage number.
    // PUT /shipments/{id}/agv-lines
    updateAgvLines: build.mutation<ShipmentRecord, { id: number; body: AgvLinesPayload }>({
      query: ({ id, body }) => ({ url: shipmentPath(id, "/agv-lines"), method: "PUT", body }),
      invalidatesTags: (_result, _error, { id }) => ["Shipment", { type: "Shipment", id }],
    }),
  }),
});

export const {
  useSearchShipmentsQuery,
  useCreateShipmentMutation,
  useGetShipmentQuery,
  useUpdateShipmentMutation,
  useUpdateAgvLinesMutation,
  useUpdateChecksMutation,
  useUpdateStageMutation,
} = shipmentsApi;
