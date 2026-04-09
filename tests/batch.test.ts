import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/rss", () => ({
  fetchArticles: vi.fn().mockResolvedValue([
    { title: "ニュース", description: "概要", link: "https://example.com" },
  ]),
}));

vi.mock("../scripts/ai", () => ({
  selectAndGenerateItems: vi.fn().mockResolvedValue(
    Array.from({ length: 5 }, (_, i) => ({
      newsTitle: `ニュース${i + 1}`,
      genreKeyword: "熟女",
      reason: "理由",
      shareText: "シェア文",
    })),
  ),
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

vi.mock("../scripts/tweet-api", () => ({
  postDailyTweet: vi.fn().mockResolvedValue(undefined),
}));

const tempRoot = path.join(process.cwd(), ".tmp-batch-test");
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

describe("generateDailyData", () => {
  it("DailyData を返す（ファイル書き込みなし）", async () => {
    const { generateDailyData } = await import("../scripts/batch");
    const result = await generateDailyData("2026-04-07");

    expect(result.date).toBe("2026-04-07");
    expect(result.items).toHaveLength(5);
    expect(result.items[0].newsTitle).toBe("ニュース1");

    // ファイルが書かれていないことを確認
    const exists = await fs
      .access(path.join(tempRoot, "data", "2026-04-07.json"))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });
});

describe("persistDailyData", () => {
  it("date.json と latest.json を書き出す (updateLatest: true)", async () => {
    const { generateDailyData, persistDailyData } = await import("../scripts/batch");
    const data = await generateDailyData("2026-04-07");
    await persistDailyData("2026-04-07", data, { updateLatest: true });

    const daily = JSON.parse(
      await fs.readFile(path.join(tempRoot, "data", "2026-04-07.json"), "utf8"),
    ) as { date: string };
    const latest = JSON.parse(
      await fs.readFile(path.join(tempRoot, "data", "latest.json"), "utf8"),
    ) as { date: string };

    expect(daily.date).toBe("2026-04-07");
    expect(latest.date).toBe("2026-04-07");
  });

  it("latest.json を更新しない (updateLatest: false)", async () => {
    const { generateDailyData, persistDailyData } = await import("../scripts/batch");
    const data = await generateDailyData("2026-04-07");
    await persistDailyData("2026-04-07", data, { updateLatest: false });

    const daily = JSON.parse(
      await fs.readFile(path.join(tempRoot, "data", "2026-04-07.json"), "utf8"),
    ) as { date: string };
    const latestExists = await fs
      .access(path.join(tempRoot, "data", "latest.json"))
      .then(() => true)
      .catch(() => false);

    expect(daily.date).toBe("2026-04-07");
    expect(latestExists).toBe(false);
  });
});

describe("runBatch", () => {
  it("generate + persist + publish を順に実行して DailyData を返す", async () => {
    const { runBatch } = await import("../scripts/batch");
    const result = await runBatch("2026-04-07");

    expect(result.date).toBe("2026-04-07");

    const latest = JSON.parse(
      await fs.readFile(path.join(tempRoot, "data", "latest.json"), "utf8"),
    ) as { date: string };
    expect(latest.date).toBe("2026-04-07");
  });
});

describe("readStatus / writeStatus", () => {
  it("存在しない場合は空オブジェクトを返す", async () => {
    const { readStatus } = await import("../scripts/batch");
    const status = await readStatus();
    expect(status).toEqual({});
  });

  it("writeStatus → readStatus で往復できる", async () => {
    const { readStatus, writeStatus } = await import("../scripts/batch");
    await writeStatus({
      "2026-04-07": { generated: true, persisted: true, deployed: false, tweeted: false },
    });
    const loaded = await readStatus();
    expect(loaded["2026-04-07"].persisted).toBe(true);
    expect(loaded["2026-04-07"].tweeted).toBe(false);
  });
});

describe("persistDailyData with status", () => {
  it("persisted:true の日付はスキップされる", async () => {
    const { generateDailyData, persistDailyData, writeStatus } = await import("../scripts/batch");
    await writeStatus({
      "2026-04-07": { generated: true, persisted: true, deployed: false, tweeted: false },
    });

    const data = await generateDailyData("2026-04-07");
    await persistDailyData("2026-04-07", data, { updateLatest: false });

    // スキップされたのでファイルが書かれないことを確認
    const exists = await fs
      .access(path.join(tempRoot, "data", "2026-04-07.json"))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });
});

describe("genre-index.json", () => {
  it("persistDailyData 後に genre-index.json が更新される", async () => {
    const { generateDailyData, persistDailyData } = await import("../scripts/batch");
    const data = await generateDailyData("2026-04-07");
    await persistDailyData("2026-04-07", data, { updateLatest: false });

    const indexPath = path.join(tempRoot, "data", "genre-index.json");
    const exists = await fs.access(indexPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const index = JSON.parse(await fs.readFile(indexPath, "utf8")) as Record<string, Array<{ date: string; itemId: number }>>;
    // genre が存在すること（fanza mock は熟女を返す）
    const allEntries = Object.values(index).flat();
    expect(allEntries.some((e) => e.date === "2026-04-07")).toBe(true);
  });

  it("同日2回実行しても genre-index に重複エントリが生まれない", async () => {
    const { generateDailyData, persistDailyData } = await import("../scripts/batch");
    const data = await generateDailyData("2026-04-07");

    // status をリセットして2回実行できるようにする
    await persistDailyData("2026-04-07", data, { updateLatest: false });
    // 2回目: persisted フラグでスキップされるので genre-index は変化しない
    await persistDailyData("2026-04-07", data, { updateLatest: false });

    const indexPath = path.join(tempRoot, "data", "genre-index.json");
    const index = JSON.parse(await fs.readFile(indexPath, "utf8")) as Record<string, Array<{ date: string; itemId: number }>>;
    const allEntries = Object.values(index).flat();
    const apr07Entries = allEntries.filter((e) => e.date === "2026-04-07");

    // 5件（アイテム数）以内であること（重複なし）
    expect(apr07Entries.length).toBeLessThanOrEqual(5);
  });
});
