import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/ledger")({
  head: () => ({
    meta: [
      { title: "Ledger | FSC" },
      { name: "description", content: "Review Rob account transfers and GSM–OX deal payments." },
      { property: "og:title", content: "Ledger | FSC" },
      {
        property: "og:description",
        content: "Review Rob account transfers and GSM–OX deal payments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});
