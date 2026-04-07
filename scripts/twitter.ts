import type { DailyData } from "./types";

function buildTweet(data: DailyData, siteUrl: string): string {
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
  const tweetSecret = process.env.TWEET_SECRET?.trim();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nukenews.vercel.app";

  if (!tweetSecret) {
    console.warn("TWEET_SECRET is not configured. Skipping tweet.");
    return;
  }

  const text = buildTweet(data, siteUrl);

  const response = await fetch(`${siteUrl}/api/tweet`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${tweetSecret}`,
    },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Tweet API error ${response.status}: ${body}`);
  }
}
