import type { DailyData } from "./types";

export function buildTweet(data: DailyData, siteUrl: string): string {
  const normalizedSiteUrl = siteUrl.replace(/\/+$/, "");
  const pageUrl = `${normalizedSiteUrl}/${data.date}`;

  return [
    "【本日の5本 📰→🔞】",
    "",
    "今日のニュース5本、",
    "どんなジャンルに変換されたか",
    "もう確認した？",
    "",
    "想像してから見るのがオススメ👇",
    pageUrl,
    "",
    "#ヌケニュース",
  ].join("\n");
}

export async function postDailyTweet(data: DailyData): Promise<void> {
  const tweetSecret = process.env.TWEET_SECRET?.trim();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://nukenews.vercel.app").replace(/\/+$/, "");

  if (!tweetSecret) {
    console.warn("TWEET_SECRET is not configured. Skipping tweet.");
    return;
  }

  const text = buildTweet(data, siteUrl);

  const response = await fetch(`${siteUrl}/api/tweet`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tweetSecret}`,
    },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Tweet API error ${response.status} from ${siteUrl}/api/tweet: ${body}`);
  }
}
