import type { WarehouseCreate, WarehouseRow, WarehouseUpdate } from "@/types/api";
import { baseApi } from "./baseApi";

/** warehouse-controller endpoints. A warehouse belongs to a receiver (party), not to a user. */
export const warehousesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // POST /warehouses/list -> a receiver's warehouses. POST, but it only reads.
    listWarehouses: build.query<WarehouseRow[], { partyId: number }>({
      query: (body) => ({ url: "/warehouses/list", method: "POST", body }),
    }),
    // POST /warehouses/create -> 201 WarehouseRow
    createWarehouse: build.mutation<WarehouseRow, WarehouseCreate>({
      query: (body) => ({ url: "/warehouses/create", method: "POST", body }),
    }),
    // PUT /warehouses/update -> WarehouseRow. The API has no delete; isActive: false deactivates.
    updateWarehouse: build.mutation<WarehouseRow, WarehouseUpdate>({
      query: (body) => ({ url: "/warehouses/update", method: "PUT", body }),
    }),
  }),
});

export const {
  useCreateWarehouseMutation,
  useLazyListWarehousesQuery,
  useUpdateWarehouseMutation,
} = warehousesApi;
