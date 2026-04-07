import { describe, expect, it, vi } from "vitest";
import { fetchArticles } from "../scripts/rss";

vi.mock("rss-parser", () => ({
  default: vi.fn().mockImplementation(() => ({
    parseString: vi.fn(),
  })),
}));

describe("fetchArticles", () => {
  it("複数RSSソースから記事を結合して返す", async () => {
    const { default: Parser } = await import("rss-parser");
    const mockParseString = vi
      .fn()
      .mockResolvedValueOnce({
        items: [
          { title: "NHKニュース1", contentSnippet: "NHK概要1", link: "https://nhk.jp/1" },
          { title: "NHKニュース2", contentSnippet: "NHK概要2", link: "https://nhk.jp/2" },
        ],
      })
      .mockResolvedValueOnce({
        items: [{ title: "Yahooニュース1", contentSnippet: "Yahoo概要1", link: "https://yahoo.jp/1" }],
      })
      .mockRejectedValueOnce(new Error("livedoor fetch failed"));

    (Parser as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      parseString: mockParseString,
    }));

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, text: async () => "<rss></rss>" })
        .mockResolvedValueOnce({ ok: true, text: async () => "<rss></rss>" })
        .mockResolvedValueOnce({ ok: true, text: async () => "<rss></rss>" }),
    );

    const articles = await fetchArticles();

    expect(articles).toHaveLength(3);
    expect(articles[0].title).toBe("NHKニュース1");
    expect(articles[0].description).toBe("NHK概要1");
    expect(articles[2].title).toBe("Yahooニュース1");
  });

  it("全ソースが失敗したときエラーをスロー", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    await expect(fetchArticles()).rejects.toThrow("全RSSソースの取得に失敗しました");
  });
});
