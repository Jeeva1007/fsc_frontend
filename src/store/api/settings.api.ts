import { baseApi } from "./baseApi";

/**
 * settings endpoints. Tag: 'Settings'.
 * Add endpoints here once the backend contract is provided, e.g.
 *   list: build.query<Result, Params>({ query: p => ({ url: '/settings', params: p }), providesTags: ['Settings'] }),
 *   save: build.mutation<Result, Body>({ query: body => ({ url: '/settings', method: 'POST', body }), invalidatesTags: ['Settings'] }),
 */
export const settingsApi = baseApi.injectEndpoints({
  endpoints: () => ({}),
});
