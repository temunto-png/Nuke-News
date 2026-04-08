import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.TWEET_SECRET?.trim();
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

  console.log("[tweet] text preview:", text.slice(0, 120));

  const appKey = process.env.TWITTER_API_KEY?.trim();
  const appSecret = process.env.TWITTER_API_SECRET?.trim();
  const accessToken = process.env.TWITTER_ACCESS_TOKEN?.trim();
  const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET?.trim();

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    return NextResponse.json({ error: "Twitter credentials not configured" }, { status: 500 });
  }

  try {
    const client = new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
    await client.v2.tweet(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const data = (err as Record<string, unknown>).data ?? null;
    const errors = (err as Record<string, unknown>).errors ?? null;
    return NextResponse.json({ error: "Twitter API error", detail: message, data, errors }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
