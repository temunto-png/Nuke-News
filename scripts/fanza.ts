import type { FanzaProduct } from "./types";

interface FanzaApiImage {
  large?: string;
  small?: string;
  list?: string;
}

interface FanzaApiItem {
  title?: string;
  affiliateURL?: string;
  imageURL?: FanzaApiImage;
}

interface FanzaApiResponse {
  result?: {
    items?: Array<{ iteminfo?: FanzaApiItem } | FanzaApiItem>;
  };
}

const API_ENDPOINT = "https://api.dmm.com/affiliate/v3/ItemList";
const FALLBACK_THUMBNAIL = "/fallback-thumb.png";
const ALLOWED_THUMBNAIL_HOSTNAMES = /^([a-z0-9-]+\.)*dmm\.(co\.jp|com)$/;

function isSafeThumbnailUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ALLOWED_THUMBNAIL_HOSTNAMES.test(parsed.hostname);
  } catch {
    return false;
  }
}

function appendTrackingParams(url: string, campaign: string, ctaType: "single" | "monthly") {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("utm_source", "nukenews");
    parsed.searchParams.set("utm_medium", "card");
    parsed.searchParams.set("utm_campaign", `${campaign}-${ctaType}`);
    return parsed.toString();
  } catch {
    return url;
  }
}

function normaliseItem(item: { iteminfo?: FanzaApiItem } | FanzaApiItem): FanzaApiItem {
  if ("iteminfo" in item && item.iteminfo) {
    return item.iteminfo;
  }

  return item as FanzaApiItem;
}

function getFallbackProduct(genreKeyword: string, campaign: string): FanzaProduct {
  const defaultUrl = process.env.FANZA_MONTHLY_AFFILIATE_URL ?? "https://www.dmm.co.jp/digital/videoa/";

  return {
    title: `${genreKeyword} のおすすめ作品`,
    thumbnailUrl: FALLBACK_THUMBNAIL,
    affiliateUrlSingle: appendTrackingParams(defaultUrl, campaign, "single"),
    affiliateUrlMonthly: appendTrackingParams(defaultUrl, campaign, "monthly"),
  };
}

async function requestItems(keyword: string, sort: "date" | "rankprofile") {
  const apiId = process.env.FANZA_API_ID;
  const affiliateId = process.env.FANZA_AFFILIATE_ID;

  if (!apiId || !affiliateId) {
    return [];
  }

  const params = new URLSearchParams({
    api_id: apiId,
    affiliate_id: affiliateId,
    site: "FANZA",
    service: "digital",
    floor: "videoa",
    hits: "10",
    keyword,
    sort,
    output: "json",
  });

  const response = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`FANZA API request failed: ${response.status}`);
  }

  const json = (await response.json()) as FanzaApiResponse;
  return (json.result?.items ?? []).map(normaliseItem);
}

function pickBestItem(items: FanzaApiItem[]): FanzaApiItem | null {
  return items.find((item) => item.title && item.affiliateURL) ?? null;
}

export async function fetchFanzaProduct(
  genreKeyword: string,
  campaign: string,
): Promise<FanzaProduct> {
  try {
    const dateSorted = await requestItems(genreKeyword, "date");
    const rankSorted = dateSorted.length === 0 ? await requestItems(genreKeyword, "rankprofile") : [];
    const picked = pickBestItem(dateSorted) ?? pickBestItem(rankSorted);

    if (!picked?.affiliateURL) {
      return getFallbackProduct(genreKeyword, campaign);
    }

    const monthlyBase = process.env.FANZA_MONTHLY_AFFILIATE_URL ?? picked.affiliateURL;

    return {
      title: picked.title ?? `${genreKeyword} のおすすめ作品`,
      thumbnailUrl: (() => {
        const url = picked.imageURL?.large ?? picked.imageURL?.list ?? picked.imageURL?.small;
        return url && isSafeThumbnailUrl(url) ? url : FALLBACK_THUMBNAIL;
      })(),
      affiliateUrlSingle: appendTrackingParams(picked.affiliateURL, campaign, "single"),
      affiliateUrlMonthly: appendTrackingParams(monthlyBase, campaign, "monthly"),
    };
  } catch (error) {
    console.warn(`FANZA lookup failed for keyword: ${genreKeyword}`, error);
    return getFallbackProduct(genreKeyword, campaign);
  }
}
