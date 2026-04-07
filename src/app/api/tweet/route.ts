import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.TWEET_SECRET;
  const auth = request.headers.get("Authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let text: unknown;
  try {
    ({ text } = await request.json() as { text: unknown });
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof text !== "string" || text.trim() === "") {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const appKey = process.env.TWITTER_API_KEY;
  const appSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    return NextResponse.json({ error: "Twitter credentials not configured" }, { status: 500 });
  }

  const client = new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
  await client.v2.tweet(text);

  return NextResponse.json({ ok: true });
}
