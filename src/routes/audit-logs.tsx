import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/audit-logs")({
  head: () => ({
    meta: [
      { title: "Audit Logs | FSC" },
      { name: "description", content: "Track who changed what in the FSC workspace, and when." },
      { property: "og:title", content: "Audit Logs | FSC" },
      {
        property: "og:description",
        content: "Track who changed what in the FSC workspace, and when.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});
