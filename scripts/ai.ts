import Anthropic from "@anthropic-ai/sdk";
import type { AiSelectedItem, RawArticle } from "./types";

const MODEL = "claude-haiku-4-5-20251001";
const TARGET_ITEMS = 5;

function cleanText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function inferGenreKeyword(article: RawArticle): string {
  const source = `${article.title} ${article.description}`;

  if (/AI|技術|ロボット|半導体|研究/i.test(source)) {
    return "未来 ロボット";
  }

  if (/首相|内閣|大臣|政治|選挙|国会/.test(source)) {
    return "女上司 支配";
  }

  if (/野球|サッカー|優勝|引退|移籍|監督/.test(source)) {
    return "アスリート";
  }

  if (/物価|経済|円安|金利|株価|日銀/.test(source)) {
    return "熟女";
  }

  if (/事件|逮捕|不祥事|流出|謝罪/.test(source)) {
    return "背徳";
  }

  return "人妻";
}

function buildFallbackItems(articles: RawArticle[]): AiSelectedItem[] {
  return articles.slice(0, TARGET_ITEMS).map((article) => ({
    newsTitle: cleanText(article.title),
    genreKeyword: inferGenreKeyword(article),
    reason: "ニュースの空気感とキーワードのズレがいちばん笑える組み合わせになるように選定した。",
    shareText: `「${cleanText(article.title)}」から何が出てくるのか、たぶん予想できない。`,
  }));
}

function buildPrompt(articles: RawArticle[]): string {
  const articleList = articles
    .map((article, index) => `${index + 1}. 【${cleanText(article.title)}】${cleanText(article.description)}`)
    .join("\n");

  return `あなたはユーモラスなWebコンテンツキュレーターです。以下のニュース記事リストを分析し、AVジャンルと最も面白い接続が作れる5件を選んでください。

ルール:
- ニュースタイトルは元の文言をそのまま使う
- genreKeyword は FANZA で検索しやすい日本語キーワードを1〜2語にする
- reason は自然な日本語で1〜2文、やや笑えるトーンにする
- shareText には作品名もジャンル名も入れない
- JSON以外の説明文は一切返さない

以下の JSON 形式のみで返答してください:
{"selected":[{"newsTitle":"...","genreKeyword":"...","reason":"...","shareText":"..."}]}

ニュース記事リスト:
${articleList}`;
}

function extractTextBlocks(content: Anthropic.Messages.Message["content"]): string {
  return content
    .filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text")
    .map((block) => block.text)
    .join("");
}

export async function selectAndGenerateItems(
  articles: RawArticle[],
): Promise<AiSelectedItem[]> {
  if (articles.length === 0) {
    throw new Error("ニュース記事が空のためAI選定を実行できません");
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const knownTitles = new Set(articles.map((article) => cleanText(article.title)));

  try {
    const PREFILL = '{"selected":[';
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [
        { role: "user", content: buildPrompt(articles) },
        { role: "assistant", content: PREFILL },
      ],
    });

    const text = PREFILL + extractTextBlocks(response.content);
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error(`AIレスポンスのJSON解析失敗: ${text.slice(0, 120)}`);
    }

    const sanitized = jsonMatch[0].replace(
      /"(?:[^"\\]|\\.)*"/g,
      (match) => match.replace(/[\x00-\x1F\x7F]/g, (c) => {
        const escapes: Record<string, string> = { "\n": "\\n", "\r": "\\r", "\t": "\\t", "\b": "\\b", "\f": "\\f" };
        return escapes[c] ?? `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`;
      })
    );
    const parsed = JSON.parse(sanitized) as { selected?: AiSelectedItem[] };

    if (!Array.isArray(parsed.selected) || parsed.selected.length === 0) {
      throw new Error("AIが選定結果を返しませんでした");
    }

    const seenTitles = new Set<string>();
    const validated = parsed.selected
      .map((item) => ({
        newsTitle: cleanText(item.newsTitle),
        genreKeyword: cleanText(item.genreKeyword),
        reason: cleanText(item.reason),
        shareText: cleanText(item.shareText),
      }))
      .filter((item) => item.newsTitle && knownTitles.has(item.newsTitle))
      .filter((item) => item.genreKeyword && item.reason && item.shareText)
      .filter((item) => {
        if (seenTitles.has(item.newsTitle)) {
          return false;
        }

        seenTitles.add(item.newsTitle);
        return true;
      });

    if (validated.length >= TARGET_ITEMS) {
      return validated.slice(0, TARGET_ITEMS);
    }

    const fallback = buildFallbackItems(
      articles.filter((article) => !seenTitles.has(cleanText(article.title))),
    );

    return [...validated, ...fallback].slice(0, TARGET_ITEMS);
  } catch (error) {
    console.warn("AI selection failed. Falling back to deterministic selection.", error);
    return buildFallbackItems(articles);
  }
}
