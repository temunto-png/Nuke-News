import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/rss", () => ({
  fetchArticles: vi.fn().mockResolvedValue([{ title: "ニュース", description: "概要", link: "https://example.com" }]),
}));

vi.mock("../scripts/ai", () => ({
  selectAndGenerateItems: vi.fn().mockResolvedValue([
    { newsTitle: "ニュース", genreKeyword: "熟女", reason: "理由", shareText: "シェア文" },
  ]),
}));

vi.mock("../scripts/fanza", () => ({
  fetchFanzaProduct: vi.fn().mockResolvedValue({
    title: "作品",
    thumbnailUrl: "https://example.com/thumb.jpg",
    affiliateUrlSingle: "https://example.com/single",
    affiliateUrlMonthly: "https://example.com/monthly",
  }),
}));

vi.mock("../scripts/deploy", () => ({
  triggerDeploy: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../scripts/twitter", () => ({
  postDailyTweet: vi.fn().mockResolvedValue(undefined),
}));

describe("runBatch", () => {
  const tempRoot = path.join(process.cwd(), ".tmp-batch-test");
  const originalCwd = process.cwd();

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("日付JSONとlatest.jsonを書き出す", async () => {
    await fs.mkdir(tempRoot, { recursive: true });
    process.chdir(tempRoot);

    const { runBatch } = await import("../scripts/batch");
    const result = await runBatch("2026-04-07");

    const dailyJson = JSON.parse(
      await fs.readFile(path.join(tempRoot, "data", "2026-04-07.json"), "utf8"),
    ) as { date: string; items: Array<{ newsTitle: string }> };
    const latestJson = JSON.parse(
      await fs.readFile(path.join(tempRoot, "data", "latest.json"), "utf8"),
    ) as { date: string; items: Array<{ newsTitle: string }> };

    expect(result.date).toBe("2026-04-07");
    expect(dailyJson.items[0].newsTitle).toBe("ニュース");
    expect(latestJson.items[0].newsTitle).toBe("ニュース");
  });
});
