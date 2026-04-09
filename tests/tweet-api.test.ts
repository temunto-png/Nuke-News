import { describe, expect, it } from "vitest";
import { buildTweet } from "../scripts/tweet-api";
import type { DailyData } from "../scripts/types";

const data: DailyData = {
  date: "2026-04-08",
  items: Array.from({ length: 5 }, (_, index) => ({
    id: index + 1,
    newsTitle: `ニュースタイトル${index}`,
    genre: "人妻",
    reason: "理由",
    shareText: `シェアテキスト${index}`,
    product: {
      title: "作品名",
      thumbnailUrl: "/fallback-thumb.png",
      affiliateUrlSingle: "https://example.com/single",
      affiliateUrlMonthly: "https://example.com/monthly",
      isFallback: false,
    },
  })),
};

describe("buildTweet", () => {
  it("trims trailing slashes from site URLs", () => {
    const tweet = buildTweet(data, "https://nukenews.vercel.app/");
    expect(tweet).toContain("https://nukenews.vercel.app/2026-04-08");
  });

  it("keeps the tweet body within 280 characters", () => {
    const tweet = buildTweet(data, "https://nukenews.vercel.app");
    expect(Array.from(tweet).length).toBeLessThanOrEqual(280);
    expect(tweet).toContain("#ヌケニュース");
  });

  it("does not include news titles or genre names", () => {
    const tweet = buildTweet(data, "https://nukenews.vercel.app");
    expect(tweet).not.toContain("ニュースタイトル");
    expect(tweet).not.toContain("人妻");
  });
});
