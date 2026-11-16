import type { UserListArgs, UserRequest, UserRow } from "@/types/api";
import { isUuid } from "@/lib/shipment-create";
import { toPage, type Page } from "@/lib/page";
import { baseApi } from "./baseApi";

/**
 * The backend's "User Management" endpoints (local Swagger, 2026-11-11). Replies come wrapped as
 * `{ message, data, result }`; baseApi unwraps them, so each endpoint gets `data` itself. There is no delete:
 * a member is deactivated by saving them with `active: false`.
 *
 *   GET  /users/usersList          all users
 *   POST /users/getUserById        one user; body { userId } (UUID), with their warehouses
 *   POST /users/createUser         new user
 *   PUT  /users/updateUser         edit; the user's id goes in the body
 */

// A saved Shipper, Receiver or CHA can change the shipment dropdowns, so those are reloaded too.
const afterSave = (_result: unknown, error: unknown) =>
  error ? [] : (["User", "MasterRecord"] as const);

/**
 * Drops the password hash (and any other credential field) the backend may include in a user row, so it
 * never reaches the Redux store, the Network-tab cache or anywhere else in the browser. The frontend never
 * needs it; the real fix is for the backend to stop serialising it.
 */
const stripSecret = (row: unknown): UserRow => {
  if (!row || typeof row !== "object") return {};
  const { password: _password, ...safe } = row as UserRow & { password?: unknown };
  return safe;
};

/** A user id for the getUserById body: a UUID (local backend) or a whole number; anything else is refused. */
const userIdBody = (id: string | number) => {
  const ok = typeof id === "number" ? Number.isSafeInteger(id) && id >= 0 : isUuid(id);
  if (!ok) throw new Error("Invalid user id");
  return { userId: String(id).trim() };
};

export const usersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * GET /users/usersList: the User Management list. Supports server-side `search`, `role` and `status`
     * filters (and page/size). With no argument it loads everyone. The reply may be a bare array or a paged
     * `{ content: [...] }`; both are handled. The password hash is stripped from every row.
     */
    listUsers: build.query<Page<UserRow>, UserListArgs | void>({
      query: (args) => ({ url: "/users/usersList", params: { ...(args ?? {}) } }),
      transformResponse: (reply: unknown) => {
        const p = toPage<UserRow>(reply);
        return { ...p, items: p.items.map(stripSecret) };
      },
      providesTags: ["User"],
    }),
    /** POST /users/getUserById { userId }: one user's details, read when the edit pop-up opens. */
    getUser: build.query<UserRow, string | number>({
      query: (id) => ({ url: "/users/getUserById", method: "POST", body: userIdBody(id) }),
      transformResponse: stripSecret,
      providesTags: (_result, _error, id) => [{ type: "User", id: String(id) }],
    }),
    /** POST /users/createUser. Any 2xx reply counts as saved, even one with an empty or non-JSON body. */
    createUser: build.mutation<UserRow, UserRequest>({
      query: (body) => ({
        url: "/users/createUser",
        method: "POST",
        body,
        responseHandler: "content-type",
      }),
      transformResponse: stripSecret,
      invalidatesTags: afterSave,
    }),
    /** PUT /users/updateUser: the body carries the user's `id`. */
    updateUser: build.mutation<UserRow, UserRequest>({
      query: (body) => ({
        url: "/users/updateUser",
        method: "PUT",
        body,
        responseHandler: "content-type",
      }),
      transformResponse: stripSecret,
      invalidatesTags: afterSave,
    }),
  }),
});

export const {
  useListUsersQuery,
  useLazyGetUserQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
} = usersApi;
