import fs from "node:fs/promises";
import path from "node:path";
import { selectAndGenerateItems } from "./ai";
import { triggerDeploy } from "./deploy";
import { fetchFanzaProduct } from "./fanza";
import { fetchArticles } from "./rss";
import { postDailyTweet } from "./tweet-api";
import type { DailyData, DailyItem } from "./types";

export function getJstDateString(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

async function writeJson(filePath: string, data: DailyData) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

// ────────────────────────────────────────────────────────────
// status.json ユーティリティ
// ────────────────────────────────────────────────────────────
export interface DateStatus {
  generated: boolean;
  persisted: boolean;
  deployed: boolean;
  tweeted: boolean;
}

export type StatusMap = Record<string, DateStatus>;

export async function readStatus(): Promise<StatusMap> {
  const statusPath = path.join(process.cwd(), "data", "status.json");
  try {
    const raw = await fs.readFile(statusPath, "utf8");
    return JSON.parse(raw) as StatusMap;
  } catch {
    return {};
  }
}

export async function writeStatus(status: StatusMap): Promise<void> {
  const dataDir = path.join(process.cwd(), "data");
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(
    path.join(dataDir, "status.json"),
    JSON.stringify(status, null, 2),
    "utf8",
  );
}

async function updateGenreIndex(date: string, items: DailyItem[]): Promise<void> {
  const indexPath = path.join(process.cwd(), "data", "genre-index.json");
  let index: Record<string, Array<{ date: string; itemId: number }>> = {};

  try {
    const raw = await fs.readFile(indexPath, "utf8");
    index = JSON.parse(raw) as typeof index;
  } catch {
    // 存在しない場合は空から開始
  }

  for (const item of items) {
    const genre = item.genre;
    if (!index[genre]) index[genre] = [];
    // 同日・同アイテムの重複を除去してから先頭に追加
    index[genre] = index[genre].filter((e) => !(e.date === date && e.itemId === item.id));
    index[genre].unshift({ date, itemId: item.id });
  }

  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), "utf8");
}

function isEnvFlagEnabled(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

// ────────────────────────────────────────────────────────────
// 1. 生成: RSS + AI + FANZA → DailyData（ファイルI/Oなし）
// ────────────────────────────────────────────────────────────
export async function generateDailyData(date: string): Promise<DailyData> {
  const articles = await fetchArticles();
  const selected = await selectAndGenerateItems(articles);

  const items: DailyItem[] = await Promise.all(
    selected.map(async (entry, index) => {
      const campaign = `${date}-item${index + 1}`;
      const product = await fetchFanzaProduct(entry.genreKeyword, campaign);
      return {
        id: index + 1,
        newsTitle: entry.newsTitle,
        genre: entry.genreKeyword,
        reason: entry.reason,
        shareText: entry.shareText,
        product,
      };
    }),
  );

  return { date, items };
}

// ────────────────────────────────────────────────────────────
// 2. 保存: date.json・latest.json を書き出す
// ────────────────────────────────────────────────────────────
export async function persistDailyData(
  date: string,
  data: DailyData,
  options: { updateLatest: boolean },
): Promise<void> {
  const status = await readStatus();
  if (status[date]?.persisted) {
    console.log(`persistDailyData: skipping ${date} (already persisted)`);
    return;
  }

  const dataDir = path.join(process.cwd(), "data");
  await writeJson(path.join(dataDir, `${date}.json`), data);
  if (options.updateLatest) {
    await writeJson(path.join(dataDir, "latest.json"), data);
  }

  await updateGenreIndex(date, data.items);

  const updated: StatusMap = {
    ...status,
    [date]: {
      ...status[date],
      generated: true,
      persisted: true,
      deployed: status[date]?.deployed ?? false,
      tweeted: status[date]?.tweeted ?? false,
    },
  };
  await writeStatus(updated);
}

// ────────────────────────────────────────────────────────────
// 3. 発火: deploy + tweet（SKIP フラグに従う）
// ────────────────────────────────────────────────────────────
export async function publishDailyData(date: string, data: DailyData): Promise<void> {
  const sideEffectEntries = [
    !isEnvFlagEnabled("SKIP_DEPLOY_HOOK") ? { name: "deploy", run: () => triggerDeploy() } : null,
    !isEnvFlagEnabled("SKIP_TWEET") ? { name: "twitter", run: () => postDailyTweet(data) } : null,
  ].filter((entry): entry is { name: string; run: () => Promise<void> } => entry !== null);

  if (sideEffectEntries.length === 0) return;

  const results = await Promise.allSettled(sideEffectEntries.map((e) => e.run()));
  const failures = results.filter((r) => r.status === "rejected");

  for (const [i, result] of results.entries()) {
    if (result.status === "rejected") {
      console.warn(
        `Side effect [${sideEffectEntries[i].name}] failed for ${date}:`,
        (result as PromiseRejectedResult).reason,
      );
    }
  }

  if (failures.length === results.length) {
    throw new Error(
      `All publish side effects failed: ${failures
        .map((r) => String((r as PromiseRejectedResult).reason))
        .join("; ")}`,
    );
  }
}

// ────────────────────────────────────────────────────────────
// エントリーポイント: 日次バッチ（generate + persist + publish）
// ────────────────────────────────────────────────────────────
export async function runBatch(date = getJstDateString()): Promise<DailyData> {
  const data = await generateDailyData(date);
  await persistDailyData(date, data, { updateLatest: true });
  await publishDailyData(date, data);
  return data;
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "batch.ts"));

if (isDirectExecution) {
  runBatch()
    .then((data) => {
      console.log(`Batch completed for ${data.date} (${data.items.length} items).`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
