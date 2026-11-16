import type { PortCha } from "@/types/api";
import { baseApi } from "./baseApi";

/** masters-controller endpoints. Tag: 'MasterRecord'. */
export const masterApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // GET /masters/options and GET /products were removed (user request, 2026-11-10): the shipment
    // dropdowns use their built-in lists.
    // GET /ports/{portCode}/chas: the CHAs working at a POD.
    portChas: build.query<PortCha[], string>({
      query: (portCode) => `/ports/${encodeURIComponent(portCode)}/chas`,
    }),
  }),
});

export const { useLazyPortChasQuery } = masterApi;
