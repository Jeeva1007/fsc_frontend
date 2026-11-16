import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { SessionUser } from "@/types/api";

const TOKEN_KEY = "fsc-token";

export type AuthState = { token: string | null; user: SessionUser | null };

const readToken = () =>
  typeof window === "undefined" ? null : window.sessionStorage.getItem(TOKEN_KEY);

export const initialAuthState = (): AuthState => ({ token: readToken(), user: null });

const authSlice = createSlice({
  name: "auth",
  initialState: initialAuthState,
  reducers: {
    credentialsSet(state, action: PayloadAction<{ token: string; user: SessionUser }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      if (typeof window !== "undefined")
        window.sessionStorage.setItem(TOKEN_KEY, action.payload.token);
    },
    userSet(state, action: PayloadAction<SessionUser | null>) {
      state.user = action.payload;
    },
    loggedOut(state) {
      state.token = null;
      state.user = null;
      if (typeof window !== "undefined") window.sessionStorage.removeItem(TOKEN_KEY);
    },
  },
});

export const { credentialsSet, userSet, loggedOut } = authSlice.actions;
export default authSlice.reducer;
