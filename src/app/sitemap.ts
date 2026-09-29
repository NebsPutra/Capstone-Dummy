import type { MetadataRoute } from "next";
import { LEGAL_DOCS, LEGAL_UPDATED } from "@/lib/legal/documents";
import { SITE_URL } from "@/lib/site";

// Public pages only: activities, profiles and the app itself need a sign-in.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/register`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${SITE_URL}/login`, changeFrequency: "yearly", priority: 0.3 },
    ...LEGAL_DOCS.map((doc) => ({
      url: `${SITE_URL}/legal/${doc}`,
      lastModified: LEGAL_UPDATED,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];
}
