import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { API_BASE_URL } from "@/config/api";
import { isApiEnvelope, unwrapApi } from "@/lib/auth-session";
import { clearStoredMe } from "@/lib/session-store";
import { loggedOut } from "../slices/authSlice";

export { API_BASE_URL };

/** One tag per backend resource; endpoints provide/invalidate these for automatic refetching. */
export const tagTypes = [
  "Session",
  "Shipment",
  "MasterRecord",
  "Payment",
  "Ledger",
  "Deal",
  "User",
  "Audit",
  "Meeting",
  "Settings",
  "Weather",
  "CostConfig",
] as const;

/** Reads a cookie by name (the backend's readable XSRF-TOKEN cookie). */
const readCookie = (name: string) => {
  if (typeof document === "undefined") return null;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
};

// The backend uses an HttpOnly session cookie plus CSRF (X-XSRF-TOKEN header), not a bearer token.
const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: "include",
  prepareHeaders: (headers, { getState }) => {
    const csrf = readCookie("XSRF-TOKEN");
    if (csrf) headers.set("X-XSRF-TOKEN", csrf);
    const token = (getState() as { auth: { token: string | null } }).auth.token;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});

type Api = Parameters<typeof rawBaseQuery>[1];
type Extra = Parameters<typeof rawBaseQuery>[2];

/**
 * The newer backend has no XSRF-TOKEN cookie: every API call sends the token from GET /auth/csrf in the
 * header that reply names (X-CSRF-TOKEN). It is fetched once and shared, and dropped after sign-in (the
 * server issues a new one) or when the server refuses it with 403.
 */
type CsrfToken = { header: string; token: string };
type Reply = Awaited<ReturnType<typeof rawBaseQuery>>;
let csrf: CsrfToken | null = null;
// One /auth/csrf request at a time: each one made without a session cookie starts a new session, so two
// at once could leave the app holding one session's token and the browser the other's cookie.
let pending: Promise<Reply> | null = null;
// Set when the backend has no /auth/csrf (the deployed one answers 401/404): stop asking for a token.
let csrfUnsupported = false;
export const resetCsrfToken = () => {
  csrf = null;
};
/** For tests: forget everything about the token, including an unsupported backend. */
export const resetCsrfState = () => {
  csrf = null;
  pending = null;
  csrfUnsupported = false;
};
/** Keeps a token from a GET /auth/csrf reply made elsewhere (the start-up session check). */
export function rememberCsrfToken(raw: unknown) {
  const data = unwrapApi(raw) as { headerName?: unknown; token?: unknown } | null;
  if (data && typeof data.token === "string" && data.token) {
    const header =
      typeof data.headerName === "string" && data.headerName ? data.headerName : "X-CSRF-TOKEN";
    csrf = { header, token: data.token };
  }
  return csrf;
}
/**
 * Records what a GET /auth/csrf reply says, wherever it was made: a token to send from now on, or that this
 * backend has none (refused, missing, or a reply with no token), so it is not asked again.
 */
function noteCsrfReply(result: { data?: unknown; error?: FetchBaseQueryError | undefined }) {
  const status = result.error?.status;
  if (status === 401 || status === 403 || status === 404 || status === 405) csrfUnsupported = true;
  const token = result.error ? null : rememberCsrfToken(result.data);
  if (!result.error && !token) csrfUnsupported = true;
  return token;
}
/** GET /auth/csrf, shared by every caller that asks while a request is already on its way. */
function fetchCsrfReply(api: Api, extra: Extra): Promise<Reply> {
  pending ??= Promise.resolve(rawBaseQuery("/auth/csrf", api, extra))
    .then((reply) => {
      noteCsrfReply(reply);
      return reply;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}
async function csrfToken(api: Api, extra: Extra) {
  if (csrf || csrfUnsupported) return csrf;
  await fetchCsrfReply(api, extra);
  return csrf;
}
const isCsrfCall = (args: string | FetchArgs) =>
  /\/auth\/csrf\/?(\?|$)/.test(typeof args === "string" ? args : args.url);
async function withCsrf(args: string | FetchArgs, api: Api, extra: Extra) {
  // The /auth/csrf token wins whenever the backend gives one. Only a backend without that endpoint (the
  // deployed one) relies on its XSRF-TOKEN cookie, sent in prepareHeaders. Do not skip this when that
  // cookie exists: a browser that used the deployed backend keeps a stale one, and the newer backend then
  // refuses every save with "Invalid or missing CSRF token".
  if (isCsrfCall(args)) return args;
  const token = await csrfToken(api, extra);
  if (!token) return args;
  const request: FetchArgs = typeof args === "string" ? { url: args } : args;
  const headers = new Headers(request.headers as HeadersInit | undefined);
  headers.set(token.header, token.token);
  return { ...request, headers };
}

/** On 401 (session expired) clears the session and invalidates it so the UI returns to sign-in. */
const baseQueryWithAuth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extra,
) => {
  if (isCsrfCall(args)) return fetchCsrfReply(api, extra);
  let result = await rawBaseQuery(await withCsrf(args, api, extra), api, extra);
  // A stale token is refused with 403: get a fresh one and try once more.
  if (result.error?.status === 403 && csrf) {
    resetCsrfToken();
    result = await rawBaseQuery(await withCsrf(args, api, extra), api, extra);
  }
  // Signing in (password or authenticator code) may start a new server session, with a new token.
  if (api.endpoint === "login" || api.endpoint === "totpVerify") resetCsrfToken();
  // Screens get the data itself, whichever envelope the backend used (see unwrapApi).
  if (!result.error && isApiEnvelope(result.data)) result = { ...result, data: result.data.data };
  // A wrong current password on login / change-password also answers 401; that is not an expired session.
  // `me` never hits the network now, so it is left out of this handler too. On the authenticator step a
  // 401 means "sign in again", which that step handles itself.
  if (
    result.error?.status === 401 &&
    api.endpoint !== "login" &&
    api.endpoint !== "totpSetup" &&
    api.endpoint !== "totpVerify" &&
    api.endpoint !== "changePassword" &&
    api.endpoint !== "me"
  ) {
    api.dispatch(loggedOut());
    clearStoredMe(); // an expired cookie must not leave a stored session that resurrects on refresh
    api.dispatch(baseApi.util.invalidateTags(["Session"]));
  }
  return result;
};

/** Endpoints are added per domain with `baseApi.injectEndpoints` (see ./*.ts). */
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithAuth,
  tagTypes,
  endpoints: () => ({}),
});
