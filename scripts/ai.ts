import Anthropic from "@anthropic-ai/sdk";
import type { AiSelectedItem, RawArticle } from "./types";

const MODEL = "claude-haiku-4-5-20251001";
const TARGET_ITEMS = 5;

function cleanText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

const FALLBACK_GENRES = [
  "人妻",
  "OL",
  "ギャル",
  "お姉さん",
  "制服",
  "熟女",
  "巨乳",
];

function inferGenreKeyword(article: RawArticle, index: number): string {
  const source = `${article.title} ${article.description}`;

  if (/AI|技術|ロボット|半導体|研究/i.test(source)) return "未来 ロボット";
  if (/首相|内閣|大臣|政治|選挙|国会/.test(source)) return "女上司 支配";
  if (/野球|サッカー|優勝|引退|移籍|監督/.test(source)) return "アスリート";
  if (/物価|経済|円安|金利|株価|日銀/.test(source)) return "熟女";
  if (/事件|逮捕|不祥事|流出|謝罪/.test(source)) return "背徳";

  // デフォルト: ローテーションでジャンル多様性を確保
  return FALLBACK_GENRES[index % FALLBACK_GENRES.length];
}

const REASON_TEMPLATES: Array<(title: string, genre: string) => string> = [
  (title, genre) =>
    `「${title}」というニュースが${genre}に繋がる理由、考えれば考えるほど笑える。`,
  (title, genre) =>
    `担当AIが「${title}」を読んで最初に思い浮かべたのが${genre}だったらしい。`,
  (title, genre) =>
    `「${title}」のどこかに${genre}の匂いがするという。AIに聞いてもはぐらかされた。`,
  (title, genre) =>
    `「${title}」から${genre}を連想するのはどういう回路なのか、本人（AI）も説明できない。`,
  (title, genre) =>
    `世の中が「${title}」で動いている間も、AIは${genre}のことを考えていた。`,
];

function buildFallbackItems(articles: RawArticle[]): AiSelectedItem[] {
  return articles.slice(0, TARGET_ITEMS).map((article, index) => {
    const genre = inferGenreKeyword(article, index);
    const title = cleanText(article.title);
    const template = REASON_TEMPLATES[index % REASON_TEMPLATES.length];
    return {
      newsTitle: title,
      genreKeyword: genre,
      reason: template(title, genre),
      shareText: `「${title}」から何が出てくるのか、たぶん予想できない。`,
    };
  });
}

function buildPrompt(articles: RawArticle[]): string {
  const articleList = articles
    .map((article, index) => `${index + 1}. 【${cleanText(article.title)}】${cleanText(article.description)}`)
    .join("\n");

  return `あなたはユーモラスなWebコンテンツキュレーターです。以下のニュース記事リストを分析し、AVジャンルと最も面白い接続が作れる5件を選んでください。

ルール:
- newsTitle はニュースタイトルの元の文言をそのまま使う
- genreKeyword は FANZA で検索しやすい日本語キーワードを1〜2語にする
- reason は自然な日本語で1〜2文、やや笑えるトーンにする
- shareText には作品名もジャンル名も入れない
- できるだけ異なる genreKeyword を使うこと（ただし検索ヒット率を優先）

ニュース記事リスト:
${articleList}`;
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
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      tools: [
        {
          name: "select_news_items",
          description: "ニュース記事からAVジャンルと関連付けるアイテムを5件選定して返す",
          input_schema: {
            type: "object" as const,
            properties: {
              selected: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    newsTitle: { type: "string" },
                    genreKeyword: { type: "string" },
                    reason: { type: "string" },
                    shareText: { type: "string" },
                  },
                  required: ["newsTitle", "genreKeyword", "reason", "shareText"],
                },
              },
            },
            required: ["selected"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "select_news_items" },
      messages: [{ role: "user", content: buildPrompt(articles) }],
    });

    const toolUseBlock = response.content.find(
      (block): block is Extract<typeof block, { type: "tool_use" }> => block.type === "tool_use"
    );
    if (!toolUseBlock) {
      throw new Error("tool_use ブロックが返されませんでした");
    }
    const parsed = toolUseBlock.input as { selected?: AiSelectedItem[] };

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
