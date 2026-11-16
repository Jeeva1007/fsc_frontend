import { baseApi } from "./baseApi";

/**
 * meetings endpoints. Tag: 'Meeting'.
 * Add endpoints here once the backend contract is provided, e.g.
 *   list: build.query<Result, Params>({ query: p => ({ url: '/meetings', params: p }), providesTags: ['Meeting'] }),
 *   save: build.mutation<Result, Body>({ query: body => ({ url: '/meetings', method: 'POST', body }), invalidatesTags: ['Meeting'] }),
 */
export const meetingsApi = baseApi.injectEndpoints({
  endpoints: () => ({}),
});
