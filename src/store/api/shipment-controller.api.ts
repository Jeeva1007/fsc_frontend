import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type {
  DropdownRow,
  MasterOption,
  MasterOptions,
  ShipmentCreateRequest,
  ShipmentCreateResult,
  ShipmentListArgs,
  ShipmentListItem,
  ShipmentStageUpdateRequest,
  ShipmentStageUpdateResult,
  ShipmentUpdateRequest,
  WorkflowStage,
} from "@/types/api";
import { isUuid } from "@/lib/shipment-create";
import { toPage, type Page } from "@/lib/page";
import { baseApi } from "./baseApi";

/**
 * The backend's "shipment-controller" endpoints (local Swagger, 2026-11-11), all under /api/shipments.
 *
 *   Dropdowns  GET  shipperDropdown, receiverDropdown, polDropdown, podDropdown, linerDropdown,
 *                   linkedAgencyDropdown, stagesDropdown, chaDropdown?portId=<POD id>
 *   Shipments  GET  shipmentList             the shipments table     -> paged { content: row[], ... }
 *              POST createShipment           new shipment            -> { id, fileNo, containerNumber, ... }
 *              PUT  updateShipment           edit (needs shipmentId)  -> same reply as create
 *              PUT  updateStage              set one workflow stage   -> the stage after the change
 *              POST getShipmentById { shipmentId } one shipment's summary -> same reply as create
 *
 * baseApi already unwraps the `{ success, message, data }` envelope, so each endpoint gets `data` itself,
 * and adds the CSRF token to every call. Ids are UUIDs, except workflow stage ids (numbers).
 */

/**
 * Which dropdown list feeds which form field. The keys are the names the Add Shipment form already reads
 * (see masterChoices in src/lib/master-choices.ts), so the form needs no other change.
 */
export const DROPDOWN_LISTS = {
  shippers: "/shipments/shipperDropdown", // Shipper
  parties: "/shipments/receiverDropdown", // Receiver
  countries: "/shipments/polDropdown", // POL
  ports: "/shipments/podDropdown", // POD
  shippingLines: "/shipments/linerDropdown", // Liner
  linkedServices: "/shipments/linkedAgencyDropdown", // Linked Agencies
  products: "/shipments/productDropdown", // Product (name shown, UUID sent as productId)
  userCountries: "/users/countryDropdown", // User Management Country (id, code, name) -> countryId
} as const;

/** Turns `[{ id, code, name }]` rows into dropdown options, skipping rows without an id or a label. */
export function dropdownOptions(rows: unknown): MasterOption[] {
  if (!Array.isArray(rows)) return [];
  return (rows as DropdownRow[]).flatMap((row) => {
    const id = typeof row?.id === "string" ? row.id.trim() : "";
    const code = typeof row?.code === "string" ? row.code.trim() : "";
    const name = typeof row?.name === "string" ? row.name.trim() : "";
    if (!id || (!code && !name)) return [];
    return [{ id, ...(code ? { code } : {}), ...(name ? { name } : {}) }];
  });
}

/** A shipment UUID for the getShipmentById body; anything else is refused. */
const shipmentIdBody = (id: string) => {
  if (!isUuid(id)) throw new Error("Invalid shipment id");
  return { shipmentId: id.trim() };
};

/** Cache tag every shipment list provides, so creating or editing a shipment refetches all of them. */
const SHIPMENT_LIST = { type: "Shipment" as const, id: "LIST" };

export const shipmentControllerApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // ---------- Dropdowns ----------

    /**
     * Loads every dropdown list at once. If one list fails, only that dropdown falls back to its built-in
     * values; the whole request fails only when every list fails.
     */
    shipmentDropdowns: build.query<MasterOptions, void>({
      async queryFn(_arg, _api, _extra, baseQuery) {
        const lists = Object.entries(DROPDOWN_LISTS);
        const replies = await Promise.all(lists.map(([, url]) => baseQuery(url)));
        if (replies.every((reply) => reply.error)) {
          return { error: replies[0]!.error as FetchBaseQueryError };
        }
        const options: MasterOptions = {};
        lists.forEach(([key], i) => {
          const reply = replies[i]!;
          options[key] = reply.error ? [] : dropdownOptions(reply.data);
        });
        return { data: options };
      },
      providesTags: ["MasterRecord"],
    }),

    /** GET stagesDropdown: the workflow stages, used to send a status as `workflowStageId`. */
    workflowStages: build.query<WorkflowStage[], void>({
      query: () => "/shipments/stagesDropdown",
      transformResponse: (rows: unknown) => (Array.isArray(rows) ? (rows as WorkflowStage[]) : []),
      providesTags: ["MasterRecord"],
    }),

    /** GET chaDropdown?portId=: the CHAs working at one POD (the POD's UUID). */
    chaDropdown: build.query<MasterOption[], string>({
      query: (portId) => ({ url: "/shipments/chaDropdown", params: { portId } }),
      transformResponse: dropdownOptions,
    }),

    // ---------- Shipments ----------

    /**
     * GET shipmentList: the shipments table. The reply is a paged envelope whose `content` is an array of
     * untyped rows; this returns that array (mapped to the screen's shape by `shipmentListRows`). With no
     * argument it asks for page 0, size 10; pass `{ page, size }` for more.
     */
    shipmentList: build.query<Page<ShipmentListItem>, ShipmentListArgs | void>({
      query: (args) => ({
        url: "/shipments/shipmentList",
        params: { page: 0, size: 10, ...(args ?? {}) },
      }),
      transformResponse: (reply: unknown) => toPage<ShipmentListItem>(reply),
      // SHIPMENT_LIST lets a save refetch every shipment list (all pages / filters) without also refetching
      // every other shipment's summary.
      providesTags: ["Shipment", SHIPMENT_LIST],
    }),

    /**
     * POST createShipment: saves a new shipment and returns its UUID. Afterwards every shipment list is
     * fetched again (so the new row shows on every page / tab / role screen), and the shipper ledgers too
     * (its AGV is a statement charge). RTK also runs this after a refused save, putting the screen back to
     * what the server holds.
     */
    createShipmentRequest: build.mutation<ShipmentCreateResult, ShipmentCreateRequest>({
      query: (body) => ({ url: "/shipments/createShipment", method: "POST", body }),
      invalidatesTags: ["Shipment", "Ledger"],
    }),

    /**
     * PUT updateShipment: saves an edit; the body carries the shipment's UUID as `shipmentId`. Afterwards the
     * shipment lists, this shipment's summary and the shipper ledgers (AGV charge, payments that ride along)
     * are fetched again. (An id-only tag would not refetch the lists, which provide no id.)
     */
    updateShipmentRequest: build.mutation<ShipmentCreateResult, ShipmentUpdateRequest>({
      query: (body) => ({ url: "/shipments/updateShipment", method: "PUT", body }),
      invalidatesTags: (_result, _error, body) => [
        { type: "Shipment", id: body.shipmentId },
        SHIPMENT_LIST,
        "Ledger",
      ],
    }),

    /**
     * PUT updateStage: moves a shipment to a stage, or ticks / unticks one workflow stage (a document
     * checkbox). Afterwards the shipment lists, this shipment's summary and the shipper ledgers (a container's
     * arrival is a statement charge) are fetched again.
     */
    updateShipmentStage: build.mutation<ShipmentStageUpdateResult, ShipmentStageUpdateRequest>({
      query: (body) => ({ url: "/shipments/updateStage", method: "PUT", body }),
      invalidatesTags: (_result, _error, body) => [
        { type: "Shipment", id: body.shipmentId },
        SHIPMENT_LIST,
        "Ledger",
      ],
    }),

    /** POST getShipmentById { shipmentId }: one shipment's summary (file no., container no., AGV amount). */
    shipmentSummary: build.query<ShipmentCreateResult, string>({
      query: (id) => ({
        url: "/shipments/getShipmentById",
        method: "POST",
        body: shipmentIdBody(id),
      }),
      providesTags: (_result, _error, id) => [{ type: "Shipment", id }],
    }),
  }),
});

export const {
  useShipmentListQuery,
  useShipmentDropdownsQuery,
  useWorkflowStagesQuery,
  useLazyChaDropdownQuery,
  useCreateShipmentRequestMutation,
  useUpdateShipmentRequestMutation,
  useUpdateShipmentStageMutation,
  useLazyShipmentSummaryQuery,
} = shipmentControllerApi;
