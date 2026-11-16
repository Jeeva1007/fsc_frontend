import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FSC | Shipment Dashboard" },
      {
        name: "description",
        content:
          "Monitor shipments, clearance assignments and payments in the FSC operations workspace.",
      },
      { property: "og:title", content: "FSC | Shipment Dashboard" },
      { property: "og:description", content: "A clear overview of your supply chain operations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});
