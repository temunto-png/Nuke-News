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
    `「${title}」を読んだとき、AIの頭の中で最初に浮かんだのが${genre}だった。その判断プロセスは今も解明されていない。`,
  (title, genre) =>
    `世間が「${title}」に注目している間、AIは一貫して${genre}のことを考えていた。集中力がすごい。`,
  (title, genre) =>
    `「${title}」と${genre}の間には、普通の人間には見えない何かがある。AIにはそれが見えた。`,
  (title, genre) =>
    `「${title}」から${genre}に至る経路、図にしたら面白いと思う。AIは一直線だったらしい。`,
  (title, genre) =>
    `「${title}」。このニュースを${genre}に変換したAIに、「なぜ？」と聞いたら黙った。`,
];

function buildFallbackItems(articles: RawArticle[]): AiSelectedItem[] {
  const usedGenres = new Set<string>();

  return articles.slice(0, TARGET_ITEMS).map((article, index) => {
    let genre = inferGenreKeyword(article, index);

    if (usedGenres.has(genre)) {
      const alternative = FALLBACK_GENRES.find((g) => !usedGenres.has(g));
      if (alternative) genre = alternative;
    }

    usedGenres.add(genre);
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
- reason は「なぜこのニュースがこのジャンルに変換されたのか」をユーモラスに説明する1〜2文にする
  - ニュースの具体的なキーワード・数字・状況を必ず拾うこと
  - 接続の論理を読者が笑いながら納得できるように書くこと
  - 「選定した」「空気感」「ズレ」など選定基準の説明は絶対に書かない
  - 良い例: 「32時間だけ停戦というのはノリが軽すぎる。『てか今日だけ休戦しよ？』くらいのテンションで言ってると思う。それはギャルだ。」
  - 良い例: 「首相が『追加放出』を宣言するとき、あの独特の上から目線がある。女上司がデスクを叩きながら『今すぐ出してきなさい』と言っている光景と完全に一致した。」
  - 悪い例: 「ニュースの空気感とキーワードのズレが笑える組み合わせになるように選定した。」← これは絶対禁止
- shareText には作品名もジャンル名も入れない
- 5件の genreKeyword はすべて異なる単語を使うこと（重複禁止）

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
    const seenGenres = new Set<string>();
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
        if (seenTitles.has(item.newsTitle) || seenGenres.has(item.genreKeyword)) {
          return false;
        }

        seenTitles.add(item.newsTitle);
        seenGenres.add(item.genreKeyword);
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
