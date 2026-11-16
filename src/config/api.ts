/**
 * The only place the backend URL is read. Change it per build with VITE_API_BASE_URL
 * in .env.development / .env.production (or the host's build environment).
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/+$/, "");
