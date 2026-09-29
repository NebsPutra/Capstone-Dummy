import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Only the public pages are worth crawling; everything else redirects to /login.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/dashboard", "/join/", "/event/", "/u/", "/messages", "/settings"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
