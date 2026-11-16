import type { AuditParams, PageResult } from "@/types/api";
import { baseApi } from "./baseApi";

/** audit-controller endpoints. Read-only. Tag: 'Audit'. */
export const auditApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // GET /audit: paged activity log; filters are from, to, userId, table, rowKey.
    listAudit: build.query<PageResult, AuditParams>({
      query: (params) => ({ url: "/audit", params }),
      providesTags: ["Audit"],
    }),
    // GET /audit/tables: the table names the log can be filtered by.
    auditTables: build.query<string[], void>({
      query: () => "/audit/tables",
    }),
  }),
});

export const { useListAuditQuery, useAuditTablesQuery } = auditApi;
