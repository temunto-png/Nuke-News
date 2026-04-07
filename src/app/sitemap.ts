import type { MetadataRoute } from "next";
import { listAvailableDates } from "./lib/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nukenews.vercel.app";
  const dates = listAvailableDates();

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...dates.map((date) => ({
      url: `${siteUrl}/${date}`,
      lastModified: new Date(`${date}T00:00:00+09:00`),
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
  ];
}
