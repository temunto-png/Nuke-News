import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchFanzaProduct } from "../scripts/fanza";

describe("fetchFanzaProduct", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.FANZA_API_ID = "api";
    process.env.FANZA_AFFILIATE_ID = "affiliate";
    process.env.FANZA_MONTHLY_AFFILIATE_URL = "https://example.com/monthly";
  });

  it("検索結果から作品情報とUTM付きURLを返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            items: [
              {
                iteminfo: {
                  title: "作品タイトル",
                  affiliateURL: "https://example.com/single",
                  imageURL: {
                    large: "https://pics.dmm.co.jp/thumb.jpg",
                  },
                },
              },
            ],
          },
        }),
      }),
    );

    const product = await fetchFanzaProduct("熟女", "2026-04-07-item1");

    expect(product.title).toBe("作品タイトル");
    expect(product.thumbnailUrl).toBe("https://pics.dmm.co.jp/thumb.jpg");
    expect(product.affiliateUrlSingle).toContain("utm_campaign=2026-04-07-item1-single");
    expect(product.affiliateUrlMonthly).toContain("utm_campaign=2026-04-07-item1-monthly");
  });

  it("dateソートで0件ならrankprofileで再試行する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { items: [] } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              items: [
                {
                  iteminfo: {
                    title: "人気作品",
                    affiliateURL: "https://example.com/single",
                  },
                },
              ],
            },
          }),
        }),
    );

    const product = await fetchFanzaProduct("熟女", "2026-04-07-item1");

    expect(product.title).toBe("人気作品");
  });

  it("API失敗時でもフォールバック作品を返してバッチを止めない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    const product = await fetchFanzaProduct("熟女", "2026-04-07-item1");

    expect(product.title).toBe("熟女 のおすすめ作品");
    expect(product.thumbnailUrl).toBe("/fallback-thumb.png");
    expect(product.isFallback).toBe(true);
    expect(product.affiliateUrlMonthly).not.toBe("");
  });

  it("API成功時は isFallback: false を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            items: [
              {
                iteminfo: {
                  title: "作品タイトル",
                  affiliateURL: "https://example.com/single",
                  imageURL: { large: "https://pics.dmm.co.jp/thumb.jpg" },
                },
              },
            ],
          },
        }),
      }),
    );

    const product = await fetchFanzaProduct("熟女", "2026-04-07-item1");
    expect(product.isFallback).toBe(false);
  });

  it("API失敗時は isFallback: true を返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    const product = await fetchFanzaProduct("熟女", "2026-04-07-item1");
    expect(product.isFallback).toBe(true);
  });

  it("FANZA_MONTHLY_AFFILIATE_URL が空文字の場合もフォールバックURLが空にならない", async () => {
    process.env.FANZA_MONTHLY_AFFILIATE_URL = "";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("api down")));

    const product = await fetchFanzaProduct("熟女", "2026-04-07-item1");
    expect(product.affiliateUrlMonthly).not.toBe("");
    expect(product.affiliateUrlMonthly).toContain("dmm.co.jp");
  });
});
