import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/user-management")({
  head: () => ({
    meta: [
      { title: "User Management | FSC" },
      { name: "description", content: "Manage FSC workspace members and their details." },
      { property: "og:title", content: "User Management | FSC" },
      { property: "og:description", content: "Manage FSC workspace members and their details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});
