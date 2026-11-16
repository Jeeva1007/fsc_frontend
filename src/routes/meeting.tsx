import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/meeting")({
  head: () => ({
    meta: [
      { title: "Meeting | FSC" },
      { name: "description", content: "Team notes and shipment operations conversations." },
      { property: "og:title", content: "Meeting | FSC" },
      { property: "og:description", content: "Team notes and shipment operations conversations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});
