import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import path from "node:path";

export default defineConfig(({ command, mode }) => {
  // Dev proxy target, from BACKEND_URL in .env.development. No VITE_ prefix, so it never reaches the browser.
  const backend = (
    loadEnv(mode, process.cwd(), "")["BACKEND_URL"] || "https://fsc.g-axis.in"
  ).replace(/\/+$/, "");
  return {
    server: {
      host: "::",
      port: 8080,
      // Dev only: lets an ngrok or Cloudflare quick tunnel reach the dev server, to try the app from another device.
      allowedHosts: [".ngrok-free.app", ".ngrok-free.dev", ".ngrok.app", ".trycloudflare.com"],
      // Vite serves files from the project root, so an ngrok link could download client spreadsheets left here.
      // Listing `deny` replaces Vite's defaults, so those are repeated.
      fs: { deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/*.{xlsx,xls,xlsm,csv}"] },
      // Dev only: the backend session cookie is SameSite=Lax and the API sends no CORS headers, so the
      // browser must talk to it same-origin. Requests to /api are forwarded to the real backend.
      proxy: {
        "/api": {
          target: backend,
          changeOrigin: true,
          secure: true,
          configure: (proxy) => {
            // Make the backend see its own origin, and let the Secure cookie work over http://localhost.
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.setHeader("origin", backend);
              // An ngrok backend otherwise answers with its HTML warning page instead of the API.
              proxyReq.setHeader("ngrok-skip-browser-warning", "1");
              // When the UI itself is reached through an ngrok tunnel (to try the app from another device),
              // that tunnel adds X-Forwarded-* headers naming the UI's own host. The backend trusts those
              // over the real Host and then sees the request as cross-origin ("Invalid CORS request", 403).
              // Drop them so the backend only sees its own host, exactly as over http://localhost.
              proxyReq.removeHeader("x-forwarded-host");
              proxyReq.removeHeader("x-forwarded-proto");
              proxyReq.removeHeader("x-forwarded-port");
              proxyReq.removeHeader("x-forwarded-for");
              proxyReq.removeHeader("forwarded");
            });
            proxy.on("proxyRes", (proxyRes) => {
              const cookies = proxyRes.headers["set-cookie"];
              if (cookies)
                proxyRes.headers["set-cookie"] = cookies.map((c) => c.replace(/;\s*Secure/i, ""));
            });
          },
        },
      },
    },
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
      tsconfigPaths: true,
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
    plugins: [
      tailwindcss(),
      tanstackStart({
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
        // Use src/server.ts (SSR error wrapper) as the server entry; nitro builds from it.
        server: { entry: "server" },
      }),
      // Production bundling only; the default target is Cloudflare, override with NITRO_PRESET.
      ...(command === "build" ? [nitro({ defaultPreset: "cloudflare-module" })] : []),
      viteReact(),
    ],
  };
});
