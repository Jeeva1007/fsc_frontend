import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/shipments")({
  head: () => ({
    meta: [
      { title: "Shipments | FSC" },
      {
        name: "description",
        content: "Track and manage shipments, goods values and clearance documents.",
      },
      { property: "og:title", content: "Shipments | FSC" },
      {
        property: "og:description",
        content: "Track and manage shipments, goods values and clearance documents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});
