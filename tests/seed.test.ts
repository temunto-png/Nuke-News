import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/rss", () => ({
  fetchArticles: vi.fn().mockResolvedValue([
    { title: "ニュース", description: "概要", link: "https://example.com" },
  ]),
}));

vi.mock("../scripts/ai", () => ({
  selectAndGenerateItems: vi.fn().mockResolvedValue([
    { newsTitle: "ニュース", genreKeyword: "熟女", reason: "理由", shareText: "シェア文" },
  ]),
}));

vi.mock("../scripts/fanza", () => ({
  fetchFanzaProduct: vi.fn().mockResolvedValue({
    title: "作品",
    thumbnailUrl: "/fallback-thumb.png",
    affiliateUrlSingle: "https://example.com/single",
    affiliateUrlMonthly: "https://example.com/monthly",
  }),
}));

vi.mock("../scripts/deploy", () => ({ triggerDeploy: vi.fn() }));
vi.mock("../scripts/tweet-api", () => ({ postDailyTweet: vi.fn() }));

const tempRoot = path.join(process.cwd(), ".tmp-seed-test");
const originalCwd = process.cwd();

beforeEach(async () => {
  await fs.mkdir(tempRoot, { recursive: true });
  process.chdir(tempRoot);
  vi.resetModules();
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe("seed", () => {
  it("指定日付分の date.json を生成し latest.json は作らない", async () => {
    const { seed } = await import("../scripts/seed");
    await seed("2026-04-09");

    // 14日分のファイルが存在する
    const dataDir = path.join(tempRoot, "data");
    const files = await fs.readdir(dataDir);
    const dateFiles = files.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
    expect(dateFiles).toHaveLength(14);

    // latest.json は作られない
    const latestExists = await fs
      .access(path.join(dataDir, "latest.json"))
      .then(() => true)
      .catch(() => false);
    expect(latestExists).toBe(false);
  });

  it("persisted:true の日付はスキップする", async () => {
    const { seed, last14Days } = await import("../scripts/seed");
    const { writeStatus } = await import("../scripts/batch");
    const dates = last14Days("2026-04-09");

    // 最初の3日分を既存として登録
    const alreadyDone = dates.slice(0, 3).reduce<
      Record<string, { generated: boolean; persisted: boolean; deployed: boolean; tweeted: boolean }>
    >(
      (acc, d) => ({
        ...acc,
        [d]: { generated: true, persisted: true, deployed: false, tweeted: false },
      }),
      {},
    );
    await writeStatus(alreadyDone);

    await seed("2026-04-09");

    const dataDir = path.join(tempRoot, "data");
    const files = await fs.readdir(dataDir);
    const dateFiles = files.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));

    // 既存3件はスキップされ 11件だけ新規作成
    expect(dateFiles).toHaveLength(11);
  });

  it("deploy と tweet は一切呼ばれない", async () => {
    const deployMock = await import("../scripts/deploy");
    const tweetMock = await import("../scripts/tweet-api");
    const { seed } = await import("../scripts/seed");

    await seed("2026-04-09");

    expect(deployMock.triggerDeploy).not.toHaveBeenCalled();
    expect(tweetMock.postDailyTweet).not.toHaveBeenCalled();
  });
});
