import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/egogift", "/event", "/cardpack"],
        disallow: ["/login", "/favorites", "/api/"],
      },
    ],
    sitemap: "https://limbus.haneuk.info/sitemap.xml",
    host: "https://limbus.haneuk.info",
  };
}

