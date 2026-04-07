import { TwitterApi } from "twitter-api-v2";
import type { DailyData } from "./types";

function buildTweet(data: DailyData, siteUrl: string) {
  const lines = data.items.map((item, index) => ` ${index + 1}.「${item.newsTitle}」`);
  return [
    "【本日の5本 📰→🔞】",
    "",
    ...lines,
    "",
    "それぞれどのジャンルになったか、想像できる？👇",
    `${siteUrl.replace(/\/$/, "")}/${data.date}`,
    "",
    "#ヌケニュース",
  ].join("\n");
}

export async function postDailyTweet(data: DailyData): Promise<void> {
  const appKey = process.env.TWITTER_API_KEY;
  const appSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    console.warn("Twitter credentials are not configured. Skipping tweet.");
    return;
  }

  const client = new TwitterApi({
    appKey,
    appSecret,
    accessToken,
    accessSecret,
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nukenews.vercel.app";
  await client.v2.tweet(buildTweet(data, siteUrl));
}
