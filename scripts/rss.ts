import Parser from "rss-parser";
import type { RawArticle } from "./types";

const RSS_SOURCES = [
  "https://www.nhk.or.jp/rss/news/cat0.xml",
  "https://news.yahoo.co.jp/rss/topics/top-picks.xml",
  "https://news.livedoor.com/topics/rss/top.xml",
];

const MAX_ARTICLES = 50;
const REQUEST_TIMEOUT_MS = 8000;

export async function fetchArticles(): Promise<RawArticle[]> {
  const parser = new Parser();
  const results: RawArticle[] = [];
  let successCount = 0;

  for (const url of RSS_SOURCES) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const xml = await response.text();
      const feed = await parser.parseString(xml);
      const articles = feed.items.map((item) => ({
        title: item.title ?? "",
        description:
          typeof item.contentSnippet === "string"
            ? item.contentSnippet
            : typeof item.content === "string"
              ? item.content
              : "",
        link: item.link ?? "",
        pubDate: item.pubDate,
      }));

      results.push(...articles);
      successCount += 1;
    } catch (error) {
      console.warn(`RSS取得失敗: ${url}`, error);
    }
  }

  if (successCount === 0) {
    throw new Error("全RSSソースの取得に失敗しました");
  }

  const seen = new Set<string>();

  return results
    .filter((article) => article.title.length > 0)
    .filter((article) => {
      const key = `${article.title}::${article.link}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, MAX_ARTICLES);
}
