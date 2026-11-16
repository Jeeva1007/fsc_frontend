import type {
  GsmOxLedgerCardsResponse,
  GsmOxLedgerListArgs,
  GsmOxLedgerRequest,
  GsmOxLedgerResponse,
  MatchedEntriesRequest,
} from "@/types/api";
import { toPage, type Page } from "@/lib/page";
import { baseApi } from "./baseApi";

/**
 * GSM-OX Deal Ledger / Debit Advice (local Swagger, 2026-11-11). Tag: 'Ledger'.
 *   GET  /gsmOxLedger/ledgerList   -> paged { content: GsmOxLedgerResponse[], ... } (filters below)
 *   POST /gsmOxLedger/createLedger -> 201 the saved entry, with its id
 *   PUT  /gsmOxLedger/updateLedger -> 200 the saved entry
 *   GET  /gsmOxLedger/cards        -> the GSM - OX Deal Ledger cards (purchase, paid / due, OX, margin)
 *   POST /gsmOxLedger/matchedEntries { searchType: BE|ORM, number } -> every entry for that BE/ORM No.
 *        (view only, no paging). A query, not a mutation: it reads, and caches per searchType+number.
 * baseApi unwraps the { success, message, data } envelope, so the list gets the page and the mutations the
 * entry. Saving invalidates 'Ledger', so the list refetches with the new row (and its id/rowVersion).
 */
export const ledgerApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listLedgers: build.query<Page<GsmOxLedgerResponse>, GsmOxLedgerListArgs | void>({
      query: (args) => ({
        url: "/gsmOxLedger/ledgerList",
        params: { page: 0, size: 10, ...(args ?? {}) },
      }),
      transformResponse: (reply: unknown) => toPage<GsmOxLedgerResponse>(reply),
      providesTags: ["Ledger"],
    }),
    ledgerCards: build.query<GsmOxLedgerCardsResponse, void>({
      query: () => "/gsmOxLedger/cards",
      // Saving a ledger entry invalidates 'Ledger', so the cards refetch with the new totals.
      providesTags: ["Ledger"],
    }),
    matchedEntries: build.query<GsmOxLedgerResponse[], MatchedEntriesRequest>({
      query: (body) => ({ url: "/gsmOxLedger/matchedEntries", method: "POST", body }),
      transformResponse: (reply: unknown) =>
        Array.isArray(reply) ? (reply as GsmOxLedgerResponse[]) : [],
      providesTags: ["Ledger"],
    }),
    createLedger: build.mutation<GsmOxLedgerResponse, GsmOxLedgerRequest>({
      query: (body) => ({ url: "/gsmOxLedger/createLedger", method: "POST", body }),
      invalidatesTags: ["Ledger"],
    }),
    updateLedger: build.mutation<GsmOxLedgerResponse, GsmOxLedgerRequest>({
      query: (body) => ({ url: "/gsmOxLedger/updateLedger", method: "PUT", body }),
      invalidatesTags: ["Ledger"],
    }),
  }),
});

export const {
  useListLedgersQuery,
  useLedgerCardsQuery,
  useMatchedEntriesQuery,
  useCreateLedgerMutation,
  useUpdateLedgerMutation,
} = ledgerApi;
