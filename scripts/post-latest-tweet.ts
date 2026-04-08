import fs from "node:fs/promises";
import path from "node:path";
import { postDailyTweet } from "./tweet-api";
import type { DailyData } from "./types";

async function main() {
  const dataPath = path.join(process.cwd(), "data", "latest.json");
  const raw = await fs.readFile(dataPath, "utf8");
  const data = JSON.parse(raw) as DailyData;

  await postDailyTweet(data);
  console.log(`Tweet posted for ${data.date}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
