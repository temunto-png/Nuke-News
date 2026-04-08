import type { DailyData } from "./types";

const MAX_TWEET_LENGTH = 280;
const SHORT_URL_LENGTH = 23;
const MAX_TITLE_LENGTH = 38;
const ELLIPSIS = "…";

function truncateText(value: string, maxLength: number): string {
  const chars = Array.from(value.trim());
  if (chars.length <= maxLength) {
    return value.trim();
  }

  return `${chars.slice(0, Math.max(0, maxLength - 1)).join("")}${ELLIPSIS}`;
}

function getWeightedTweetLength(text: string): number {
  return text.split(/(https?:\/\/\S+)/g).reduce((total, part) => {
    if (/^https?:\/\/\S+$/.test(part)) {
      return total + SHORT_URL_LENGTH;
    }

    return total + Array.from(part).length;
  }, 0);
}

export function buildTweet(data: DailyData, siteUrl: string): string {
  const normalizedSiteUrl = siteUrl.replace(/\/+$/, "");
  const intro = "【本日の5本 📰→🔞】";
  const prompt = "それぞれどのジャンルになったか、想像できる？👇";
  const pageUrl = `${normalizedSiteUrl}/${data.date}`;
  const hashtag = "#ヌケニュース";
  const lines: string[] = [];

  for (const [index, item] of data.items.entries()) {
    const candidateLine = ` ${index + 1}.「${truncateText(item.newsTitle, MAX_TITLE_LENGTH)}」`;
    const candidateTweet = [
      intro,
      "",
      ...lines,
      candidateLine,
      "",
      prompt,
      pageUrl,
      "",
      hashtag,
    ].join("\n");

    if (getWeightedTweetLength(candidateTweet) > MAX_TWEET_LENGTH) {
      break;
    }

    lines.push(candidateLine);
  }

  const finalLines = lines.length > 0 ? lines : [` 1.「${truncateText(data.items[0]?.newsTitle ?? "今日のニュース", 24)}」`];

  return [
    intro,
    "",
    ...finalLines,
    "",
    prompt,
    pageUrl,
    "",
    hashtag,
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
