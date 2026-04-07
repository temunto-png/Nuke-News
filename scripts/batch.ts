import fs from "node:fs/promises";
import path from "node:path";
import { selectAndGenerateItems } from "./ai";
import { triggerDeploy } from "./deploy";
import { fetchFanzaProduct } from "./fanza";
import { fetchArticles } from "./rss";
import { postDailyTweet } from "./twitter";
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

export async function runBatch(date = getJstDateString()): Promise<DailyData> {
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

  const data: DailyData = { date, items };
  const dataDir = path.join(process.cwd(), "data");

  await writeJson(path.join(dataDir, `${date}.json`), data);
  await writeJson(path.join(dataDir, "latest.json"), data);

  const SIDE_EFFECT_NAMES = ["deploy", "twitter"];
  const sideEffects = await Promise.allSettled([triggerDeploy(), postDailyTweet(data)]);
  const failures = sideEffects.filter((result) => result.status === "rejected");

  for (const [i, result] of sideEffects.entries()) {
    if (result.status === "rejected") {
      console.warn(`Side effect [${SIDE_EFFECT_NAMES[i]}] failed:`, (result as PromiseRejectedResult).reason);
    }
  }

  if (failures.length === sideEffects.length) {
    throw new Error(
      `Batch side effect failed: ${failures
        .map((result) => String((result as PromiseRejectedResult).reason))
        .join("; ")}`,
    );
  }

  return data;
}

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "batch.ts"));

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
