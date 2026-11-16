import type { LoginRequest, Me } from "@/types/api";
import { SIGNED_OUT, toMe } from "@/lib/auth-session";
import { readStoredMe } from "@/lib/session-store";
import { baseApi } from "./baseApi";

/** auth-controller endpoints. Tag: 'Session'. The session lives in an HttpOnly cookie. */
export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // Who is signed in. GET /auth/me is NOT called (user request, 2026-11-11): this query never hits the
    // network. On start-up it reads the signed-in `Me` that login saved to sessionStorage, so a page refresh
    // keeps the user signed in; with nothing stored it reads as signed out and the login screen shows. A
    // successful POST /auth/login upserts the `Me` here and writes it to storage; a 401 from any later call
    // (expired cookie) signs the user out and clears storage (see baseApi). The real session is the backend
    // cookie — this only restores the UI; the cookie still gates every API call.
    me: build.query<Me, void>({
      queryFn() {
        return { data: readStoredMe() ?? SIGNED_OUT };
      },
      providesTags: ["Session"],
    }),
    // POST /auth/login with { username, password } -> Me.
    login: build.mutation<Me, LoginRequest>({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
      transformResponse: (raw: unknown) => toMe(raw),
    }),
    // POST /auth/logout ends the server-side session.
    logout: build.mutation<void, void>({
      query: () => ({ url: "/auth/logout", method: "POST", responseHandler: "text" }),
    }),
    // POST /auth/password { currentPassword, newPassword }: used for the forced first-login change.
    changePassword: build.mutation<void, { currentPassword: string; newPassword: string }>({
      query: (body) => ({ url: "/auth/password", method: "POST", body, responseHandler: "text" }),
    }),
    // POST /auth/reset-request { username }: asks the server to issue a reset code.
    resetRequest: build.mutation<void, { username: string }>({
      query: (body) => ({
        url: "/auth/reset-request",
        method: "POST",
        body,
        responseHandler: "content-type", // 202 has no body; errors are JSON
      }),
    }),
    // POST /auth/reset { code, newPassword }: sets a new password using the issued code.
    resetPassword: build.mutation<void, { code: string; newPassword: string }>({
      query: (body) => ({
        url: "/auth/reset",
        method: "POST",
        body,
        responseHandler: "content-type",
      }),
    }),
  }),
});

export const {
  useMeQuery,
  useLoginMutation,
  useLogoutMutation,
  useChangePasswordMutation,
  useResetRequestMutation,
  useResetPasswordMutation,
} = authApi;
