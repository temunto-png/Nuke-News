import type { MetadataRoute } from "next";
import { listAllGenres, listAvailableDates } from "./lib/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nukenews.vercel.app").replace(/\/$/, "");
  const dates = listAvailableDates();
  const genres = listAllGenres();

  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1.0 },
    { url: `${siteUrl}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/privacy`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const datePages: MetadataRoute.Sitemap = dates.map((date) => ({
    url: `${siteUrl}/${date}`,
    changeFrequency: "never" as const,
    priority: 0.8,
    lastModified: new Date(`${date}T07:00:00+09:00`),
  }));

  const genrePages: MetadataRoute.Sitemap = genres.map((genre) => ({
    url: `${siteUrl}/genre/${encodeURIComponent(genre)}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...datePages, ...genrePages];
}
