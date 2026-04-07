# せっかくだから俺はこのニュースで抜くぜ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ニュースをAIが分析してAVジャンルに紐付け、FANZAアフィリエイトで収益化する笑えるWebアプリを構築する。

**Architecture:** GitHub Actions が毎日 AM7:00 JST にバッチ実行し、RSS取得 → Claude Haiku で5件選定・理由文生成 → FANZA API で作品取得 → JSONをVercel Deploy Hookでデプロイ → X API で自動投稿する完全自動パイプライン。フロントエンドはNext.js SSGで静的配信。

**Tech Stack:** Next.js 15 (App Router, SSG), Tailwind CSS v3, TypeScript, Claude Haiku API (`@anthropic-ai/sdk`), FANZA Affiliate API, X API v2 (`twitter-api-v2`), `rss-parser`, Vercel (`@vercel/og`), Vitest, React Testing Library

---

## ファイル構成

```
nuke-news/
├── .github/
│   └── workflows/
│       └── daily.yml                    # GitHub Actions cron (毎日 UTC 22:00 = JST 7:00)
├── scripts/
│   ├── types.ts                         # バッチ処理共有型定義
│   ├── rss.ts                           # RSS取得・正規化モジュール
│   ├── ai.ts                            # Claude Haiku API（選定＋理由文＋シェアテキスト一括）
│   ├── fanza.ts                         # FANZA Affiliate API 検索モジュール
│   ├── deploy.ts                        # Vercel Deploy Hook トリガー
│   ├── twitter.ts                       # X API v2 投稿モジュール
│   └── batch.ts                         # メインオーケストレーター
├── src/
│   └── app/
│       ├── layout.tsx                   # ルートレイアウト（サイト名・共通meta）
│       ├── page.tsx                     # トップページ（最新5件）
│       ├── [date]/
│       │   └── page.tsx                 # アーカイブページ
│       ├── api/
│       │   └── og/
│       │       └── route.tsx            # OGP画像生成 Edge Function
│       ├── components/
│       │   ├── Header.tsx               # ヘッダー + Xフォロー誘導CTA
│       │   ├── NewsCard.tsx             # ニュース-作品カード（メインUI）
│       │   └── ArchiveList.tsx          # 過去日付リスト
│       ├── lib/
│       │   └── data.ts                  # JSONデータ読み込みユーティリティ
│       └── globals.css                  # Tailwind import
├── data/
│   └── latest.json                      # 最新バッチ成功データ（フォールバック用）
├── public/
│   └── fallback-thumb.png               # サムネ404時のフォールバック画像
├── tests/
│   ├── rss.test.ts
│   ├── ai.test.ts
│   ├── fanza.test.ts
│   ├── batch.test.ts
│   └── components/
│       ├── NewsCard.test.tsx
│       └── ArchiveList.test.tsx
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

---

## 環境変数一覧

| 変数名 | 説明 | 取得先 |
|--------|------|--------|
| `ANTHROPIC_API_KEY` | Claude API キー | console.anthropic.com |
| `FANZA_API_ID` | FANZA API ID | affiliate.dmm.com |
| `FANZA_AFFILIATE_ID` | FANZAアフィリエイトID（例: `yourname-990`） | affiliate.dmm.com |
| `FANZA_MONTHLY_AFFILIATE_URL` | FANZA月額サービスアフィリエイトURL（固定） | affiliate.dmm.com |
| `TWITTER_API_KEY` | X API Consumer Key | developer.twitter.com |
| `TWITTER_API_SECRET` | X API Consumer Secret | developer.twitter.com |
| `TWITTER_ACCESS_TOKEN` | X Access Token | developer.twitter.com |
| `TWITTER_ACCESS_TOKEN_SECRET` | X Access Token Secret | developer.twitter.com |
| `VERCEL_DEPLOY_HOOK_URL` | Vercel Deploy Hook URL | Vercel Dashboard > Settings > Git > Deploy Hooks |
| `NEXT_PUBLIC_SITE_URL` | 本番サイトURL（例: `https://nukenews.vercel.app`） | Vercel デプロイ後に確認 |
| `NEXT_PUBLIC_TWITTER_HANDLE` | XアカウントID（例: `nukenews_jp`） | X アカウント作成後 |

---

## Task 1: プロジェクト初期化

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `vitest.config.ts`
- Create: `src/app/globals.css`
- Create: `.env.example`

- [ ] **Step 1: リポジトリをcloneしてNext.jsプロジェクトを作成**

リポジトリは既に作成済み（https://github.com/temunto-png/Nuke-News.git）。
cloneしてルートに直接Next.jsプロジェクトを展開する。

```bash
git clone https://github.com/temunto-png/Nuke-News.git nuke-news
cd nuke-news

# 一時ディレクトリに create-next-app を展開してからルートにコピー
npx create-next-app@15 .tmp-next \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --no-git

# .gitignore等を除いてルートにコピー（既存ファイルは上書きしない）
cp -rn .tmp-next/. .
rm -rf .tmp-next
```

- [ ] **Step 2: 追加パッケージをインストール**

```bash
npm install @anthropic-ai/sdk rss-parser twitter-api-v2
npm install --save-dev vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @types/rss-parser tsx
```

- [ ] **Step 3: `vitest.config.ts` を作成**

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 4: `tests/setup.ts` を作成**

```typescript
// tests/setup.ts
import "@testing-library/jest-dom";
```

- [ ] **Step 5: `package.json` の scripts に追記**

`package.json` の `"scripts"` セクションに以下を追加：

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest",
  "batch": "tsx scripts/batch.ts"
}
```

- [ ] **Step 6: `next.config.ts` を更新**

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.dmm.co.jp",
      },
      {
        protocol: "https",
        hostname: "**.dmm.com",
      },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 7: `.env.example` を作成**

```bash
# .env.example
ANTHROPIC_API_KEY=sk-ant-...
FANZA_API_ID=your_api_id
FANZA_AFFILIATE_ID=yourname-990
FANZA_MONTHLY_AFFILIATE_URL=https://al.dmm.co.jp/?lurl=...
TWITTER_API_KEY=...
TWITTER_API_SECRET=...
TWITTER_ACCESS_TOKEN=...
TWITTER_ACCESS_TOKEN_SECRET=...
VERCEL_DEPLOY_HOOK_URL=https://api.vercel.com/v1/integrations/deploy/...
NEXT_PUBLIC_SITE_URL=https://nukenews.vercel.app
NEXT_PUBLIC_TWITTER_HANDLE=nukenews_jp
```

- [ ] **Step 8: `data/` ディレクトリと初期フォールバックJSONを作成**

```bash
mkdir -p data
```

```json
// data/latest.json
{
  "date": "2026-04-07",
  "items": []
}
```

- [ ] **Step 9: 初回コミット**

```bash
git add .
git commit -m "feat: initial Next.js project setup"
git push origin main
```

---

## Task 2: 共有型定義

**Files:**
- Create: `scripts/types.ts`

- [ ] **Step 1: 型定義ファイルを作成**

```typescript
// scripts/types.ts

/** RSS取得した生記事 */
export interface RawArticle {
  title: string;
  description: string;
  link: string;
  pubDate?: string;
}

/** AIが返す選定結果（1件分） */
export interface AiSelectedItem {
  newsTitle: string;
  genreKeyword: string;
  reason: string;
  shareText: string;
}

/** FANZAから取得した作品情報 */
export interface FanzaProduct {
  title: string;
  thumbnailUrl: string;
  affiliateUrlSingle: string;
  affiliateUrlMonthly: string;
}

/** 1日分のデータの1アイテム（JSONに保存する形式） */
export interface DailyItem {
  id: number;
  newsTitle: string;
  genre: string;
  reason: string;
  shareText: string;
  product: FanzaProduct;
}

/** JSONファイル全体の形式 */
export interface DailyData {
  date: string;
  items: DailyItem[];
}
```

- [ ] **Step 2: コミット**

```bash
git add scripts/types.ts
git commit -m "feat: add shared TypeScript types for batch pipeline"
```

---

## Task 3: RSS取得モジュール

**Files:**
- Create: `scripts/rss.ts`
- Create: `tests/rss.test.ts`

- [ ] **Step 1: テストを先に作成**

```typescript
// tests/rss.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchArticles } from "../scripts/rss";

// rss-parser をモック
vi.mock("rss-parser", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      parseURL: vi.fn(),
    })),
  };
});

describe("fetchArticles", () => {
  it("複数RSSソースから記事を結合して返す", async () => {
    const { default: Parser } = await import("rss-parser");
    const mockParseURL = vi.fn()
      .mockResolvedValueOnce({
        items: [
          { title: "NHKニュース1", contentSnippet: "NHK概要1", link: "https://nhk.jp/1" },
          { title: "NHKニュース2", contentSnippet: "NHK概要2", link: "https://nhk.jp/2" },
        ],
      })
      .mockResolvedValueOnce({
        items: [
          { title: "Yahooニュース1", contentSnippet: "Yahoo概要1", link: "https://yahoo.jp/1" },
        ],
      })
      .mockRejectedValueOnce(new Error("livedoor fetch failed"));

    (Parser as any).mockImplementation(() => ({ parseURL: mockParseURL }));

    const articles = await fetchArticles();

    expect(articles).toHaveLength(3);
    expect(articles[0].title).toBe("NHKニュース1");
    expect(articles[0].description).toBe("NHK概要1");
    expect(articles[2].title).toBe("Yahooニュース1");
  });

  it("全ソースが失敗したときエラーをスロー", async () => {
    const { default: Parser } = await import("rss-parser");
    const mockParseURL = vi.fn().mockRejectedValue(new Error("network error"));
    (Parser as any).mockImplementation(() => ({ parseURL: mockParseURL }));

    await expect(fetchArticles()).rejects.toThrow("全RSSソースの取得に失敗しました");
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npx vitest run tests/rss.test.ts
```

Expected: FAIL with "Cannot find module '../scripts/rss'"

- [ ] **Step 3: `scripts/rss.ts` を実装**

```typescript
// scripts/rss.ts
import Parser from "rss-parser";
import type { RawArticle } from "./types";

const RSS_SOURCES = [
  "https://www.nhk.or.jp/rss/news/cat0.xml",
  "https://news.yahoo.co.jp/rss/topics/top-picks.xml",
  "http://news.livedoor.com/topics/rss/top.xml",
];

const MAX_ARTICLES = 50;

/**
 * 複数RSSソースから記事を取得する。
 * 1つのソースが失敗しても他のソースで継続する。
 * 全ソースが失敗した場合はエラーをスロー。
 */
export async function fetchArticles(): Promise<RawArticle[]> {
  const parser = new Parser();
  const results: RawArticle[] = [];
  let successCount = 0;

  for (const url of RSS_SOURCES) {
    try {
      const feed = await parser.parseURL(url);
      const articles = feed.items.map((item) => ({
        title: item.title ?? "",
        description: item.contentSnippet ?? item.content ?? "",
        link: item.link ?? "",
        pubDate: item.pubDate,
      }));
      results.push(...articles);
      successCount++;
    } catch (error) {
      console.warn(`RSS取得失敗: ${url}`, error);
    }
  }

  if (successCount === 0) {
    throw new Error("全RSSソースの取得に失敗しました");
  }

  // タイトルが空の記事を除外し、最大件数に制限
  return results
    .filter((a) => a.title.length > 0)
    .slice(0, MAX_ARTICLES);
}
```

- [ ] **Step 4: テストを実行して成功を確認**

```bash
npx vitest run tests/rss.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: コミット**

```bash
git add scripts/rss.ts tests/rss.test.ts
git commit -m "feat: add RSS fetch module with multi-source fallback"
```

---

## Task 4: Claude Haiku AI モジュール

**Files:**
- Create: `scripts/ai.ts`
- Create: `tests/ai.test.ts`

- [ ] **Step 1: テストを先に作成**

```typescript
// tests/ai.test.ts
import { describe, it, expect, vi } from "vitest";
import { selectAndGenerateItems } from "../scripts/ai";
import type { RawArticle } from "../scripts/types";

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}));

const mockArticles: RawArticle[] = [
  { title: "日銀、金利据え置きを決定", description: "日銀は本日の会合で...", link: "https://nhk.jp/1" },
  { title: "プロ野球選手が電撃引退", description: "人気選手が突然...", link: "https://nhk.jp/2" },
  { title: "新内閣が発足", description: "総理大臣が...", link: "https://nhk.jp/3" },
  { title: "物価上昇が止まらず", description: "消費者物価指数が...", link: "https://nhk.jp/4" },
  { title: "AI技術で新発見", description: "研究者たちが...", link: "https://nhk.jp/5" },
];

const mockAiResponse = {
  selected: [
    {
      newsTitle: "日銀、金利据え置きを決定",
      genreKeyword: "熟女",
      reason: "長年の経験で培った安定した手さばきが、今の日本経済にそのまま重なった。",
      shareText: "「日銀が金利を据え置いた」— このニュースで選ばれた作品、絶対わからんと思う。",
    },
    {
      newsTitle: "プロ野球選手が電撃引退",
      genreKeyword: "引退 熟年",
      reason: "華々しいキャリアの幕引き。もう一度だけ輝く姿を見せてくれた。",
      shareText: "「電撃引退」のニュース、どんな作品に変換されたか想像できる？",
    },
    {
      newsTitle: "新内閣が発足",
      genreKeyword: "女上司 支配",
      reason: "新しい権力構造の誕生。圧倒的な存在感で部下を導く姿と重なった。",
      shareText: "内閣発足ニュース、どんな作品になったかは見てからのお楽しみ。",
    },
    {
      newsTitle: "物価上昇が止まらず",
      genreKeyword: "ギャル 若妻",
      reason: "上がり続ける欲望と現実のギャップ。止められない衝動を描いた作品が浮かんだ。",
      shareText: "物価上昇ニュース、こんな作品になるとは誰も思わなかったはず。",
    },
    {
      newsTitle: "AI技術で新発見",
      genreKeyword: "ロボット 未来",
      reason: "人類の知の結晶が生み出した新境地。AIならではの無限の可能性が作品に宿る。",
      shareText: "AI新発見のニュースで選ばれた作品、技術の進歩を感じてほしい。",
    },
  ],
};

describe("selectAndGenerateItems", () => {
  it("5件の選定結果をAiSelectedItem[]で返す", async () => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    (Anthropic as any).mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: JSON.stringify(mockAiResponse) }],
        }),
      },
    }));

    const result = await selectAndGenerateItems(mockArticles);

    expect(result).toHaveLength(5);
    expect(result[0].newsTitle).toBe("日銀、金利据え置きを決定");
    expect(result[0].genreKeyword).toBe("熟女");
    expect(result[0].reason).toContain("手さばき");
    expect(result[0].shareText).toContain("絶対わからんと思う");
  });

  it("AIがJSONでない文字列を返した場合エラーをスロー", async () => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    (Anthropic as any).mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "申し訳ありませんが..." }],
        }),
      },
    }));

    await expect(selectAndGenerateItems(mockArticles)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npx vitest run tests/ai.test.ts
```

Expected: FAIL with "Cannot find module '../scripts/ai'"

- [ ] **Step 3: `scripts/ai.ts` を実装**

```typescript
// scripts/ai.ts
import Anthropic from "@anthropic-ai/sdk";
import type { RawArticle, AiSelectedItem } from "./types";

const MODEL = "claude-haiku-4-5-20251001";

function buildPrompt(articles: RawArticle[]): string {
  const articleList = articles
    .map((a, i) => `${i + 1}. 【${a.title}】${a.description}`)
    .join("\n");

  return `あなたはユーモラスなWebコンテンツキュレーターです。以下のニュース記事リストを分析し、AVジャンルと最も面白い接続が作れる5件を選んでください。

選定基準（どちらか面白い方を採用）：
A. キーワード的意外性: ニュースの表面的なキーワードが思わぬAVジャンルと結びつく（例：「金利据え置き」→熟女系の「変わらない安定した魅力」）
B. 感情トーンマッピング: ニュースの感情・雰囲気がジャンルに自然に対応（例：「政治スキャンダル」→禁断・背徳系）

各記事について以下を生成してください：
- newsTitle: 元のニュースタイトルをそのまま使用
- genreKeyword: FANZA APIで検索するキーワード（「熟女」「女教師」「痴女」「ギャル」「人妻」など実在するジャンル名1〜2語）
- reason: なぜこのジャンルを選んだかの説明（1〜2文、自然な日本語、やや笑えるトーン、作品名は不要）
- shareText: Xポスト用ティザーテキスト（作品名・ジャンル名を絶対に含めない、好奇心を煽る、80文字以内）

以下のJSON形式のみで返答してください（前後に説明文不要）：
{"selected":[{"newsTitle":"...","genreKeyword":"...","reason":"...","shareText":"..."}]}

ニュース記事リスト：
${articleList}`;
}

/**
 * ニュース記事リストからAIが5件を選定し、ジャンル・理由文・シェアテキストを一括生成する。
 */
export async function selectAndGenerateItems(
  articles: RawArticle[]
): Promise<AiSelectedItem[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: buildPrompt(articles) }],
  });

  const text = response.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { type: "text"; text: string }).text)
    .join("");

  // JSONのみ抽出（前後の余分な文字を除去）
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`AIレスポンスのJSON解析失敗: ${text.slice(0, 100)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as { selected: AiSelectedItem[] };

  if (!Array.isArray(parsed.selected) || parsed.selected.length === 0) {
    throw new Error("AIが選定結果を返しませんでした");
  }

  return parsed.selected.slice(0, 5);
}
```

- [ ] **Step 4: テストを実行して成功を確認**

```bash
npx vitest run tests/ai.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: コミット**

```bash
git add scripts/ai.ts tests/ai.test.ts
git commit -m "feat: add Claude Haiku AI module for bulk selection and generation"
```

---

## Task 5: FANZA API モジュール

**Files:**
- Create: `scripts/fanza.ts`
- Create: `tests/fanza.test.ts`

- [ ] **Step 1: テストを先に作成**

```typescript
// tests/fanza.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchProduct } from "../scripts/fanza";

global.fetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FANZA_API_ID = "test_api_id";
  process.env.FANZA_AFFILIATE_ID = "testuser-990";
  process.env.FANZA_MONTHLY_AFFILIATE_URL = "https://al.dmm.co.jp/?lurl=monthly";
});

const mockFanzaResponse = {
  result: {
    status: 200,
    items: [
      {
        title: "テスト作品タイトル",
        affiliateURL: "https://al.dmm.co.jp/?lurl=product1",
        imageURL: {
          large: "https://pics.dmm.co.jp/thumbnail/large.jpg",
        },
        date: "2026-01-01",
        // dateがあれば新作判定
      },
    ],
  },
};

describe("searchProduct", () => {
  it("キーワードでFANZAを検索して作品情報を返す", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockFanzaResponse,
    });

    const product = await searchProduct("熟女", "2026-04-07", 1);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("api.dmm.com/affiliate/v3/ItemList")
    );
    expect(product.title).toBe("テスト作品タイトル");
    expect(product.thumbnailUrl).toBe("https://pics.dmm.co.jp/thumbnail/large.jpg");
    expect(product.affiliateUrlSingle).toContain("utm_source=nukenews");
    expect(product.affiliateUrlSingle).toContain("2026-04-07-item1-single");
    expect(product.affiliateUrlMonthly).toContain("2026-04-07-item1-monthly");
  });

  it("検索結果が0件のときフォールバック作品を返す", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { status: 200, items: [] } }),
    });

    const product = await searchProduct("存在しないジャンル", "2026-04-07", 1);

    expect(product.title).toBe("FANZA作品を見る");
    expect(product.thumbnailUrl).toBe("/fallback-thumb.png");
  });

  it("APIがエラーを返したときフォールバック作品を返す", async () => {
    (fetch as any).mockRejectedValueOnce(new Error("network error"));

    const product = await searchProduct("熟女", "2026-04-07", 1);

    expect(product.title).toBe("FANZA作品を見る");
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npx vitest run tests/fanza.test.ts
```

Expected: FAIL with "Cannot find module '../scripts/fanza'"

- [ ] **Step 3: `scripts/fanza.ts` を実装**

```typescript
// scripts/fanza.ts
import type { FanzaProduct } from "./types";

const FANZA_API_BASE = "https://api.dmm.com/affiliate/v3/ItemList";

const FALLBACK_PRODUCT: Omit<FanzaProduct, "affiliateUrlSingle" | "affiliateUrlMonthly"> = {
  title: "FANZA作品を見る",
  thumbnailUrl: "/fallback-thumb.png",
};

function buildAffiliateUrl(
  baseUrl: string,
  date: string,
  itemId: number,
  type: "single" | "monthly"
): string {
  const campaign = `${date}-item${itemId}-${type}`;
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}utm_source=nukenews&utm_medium=card&utm_campaign=${campaign}`;
}

/**
 * ジャンルキーワードでFANZA APIを検索し、上位1件の作品情報を返す。
 * 失敗時はフォールバック作品を返す（例外をスローしない）。
 */
export async function searchProduct(
  genreKeyword: string,
  date: string,
  itemId: number
): Promise<FanzaProduct> {
  const monthlyBaseUrl = process.env.FANZA_MONTHLY_AFFILIATE_URL ?? "";

  const buildResult = (baseAffiliate: string, title: string, thumbnailUrl: string): FanzaProduct => ({
    title,
    thumbnailUrl,
    affiliateUrlSingle: buildAffiliateUrl(baseAffiliate, date, itemId, "single"),
    affiliateUrlMonthly: buildAffiliateUrl(monthlyBaseUrl, date, itemId, "monthly"),
  });

  try {
    // 新作優先（date sort）で検索。結果0件なら人気順（rankprofile）にフォールバック
    const buildParams = (sort: string) =>
      new URLSearchParams({
        api_id: process.env.FANZA_API_ID ?? "",
        affiliate_id: process.env.FANZA_AFFILIATE_ID ?? "",
        site: "FANZA",
        service: "digital",
        floor: "videoa",
        hits: "5",
        sort,
        keyword: genreKeyword,
        output: "json",
      });

    type FanzaItem = { title: string; affiliateURL: string; imageURL: { large: string } };
    type FanzaResponse = { result: { status: number; items?: FanzaItem[] } };

    const fetchItems = async (sort: string): Promise<FanzaItem[]> => {
      const response = await fetch(`${FANZA_API_BASE}?${buildParams(sort).toString()}`);
      if (!response.ok) throw new Error(`FANZA API error: ${response.status}`);
      const data = (await response.json()) as FanzaResponse;
      return data.result.items ?? [];
    };

    // 新作で検索し、0件なら人気順で再試行
    let items = await fetchItems("date");
    if (items.length === 0) {
      items = await fetchItems("rankprofile");
    }

    if (items.length === 0) {
      return {
        ...FALLBACK_PRODUCT,
        affiliateUrlSingle: buildAffiliateUrl(monthlyBaseUrl, date, itemId, "single"),
        affiliateUrlMonthly: buildAffiliateUrl(monthlyBaseUrl, date, itemId, "monthly"),
      };
    }

    const item = items[0];
    return buildResult(item.affiliateURL, item.title, item.imageURL.large);
  } catch (error) {
    console.warn(`FANZA検索失敗 (keyword: ${genreKeyword}):`, error);
    return {
      ...FALLBACK_PRODUCT,
      affiliateUrlSingle: buildAffiliateUrl(monthlyBaseUrl, date, itemId, "single"),
      affiliateUrlMonthly: buildAffiliateUrl(monthlyBaseUrl, date, itemId, "monthly"),
    };
  }
}
```

- [ ] **Step 4: テストを実行して成功を確認**

```bash
npx vitest run tests/fanza.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: コミット**

```bash
git add scripts/fanza.ts tests/fanza.test.ts
git commit -m "feat: add FANZA affiliate API module with fallback"
```

---

## Task 6: Vercel Deploy Hook と X API モジュール

**Files:**
- Create: `scripts/deploy.ts`
- Create: `scripts/twitter.ts`

- [ ] **Step 1: `scripts/deploy.ts` を作成**

```typescript
// scripts/deploy.ts

/**
 * Vercel Deploy Hook URLにPOSTしてデプロイをトリガーする。
 * git pushなしでデプロイできるため、GitHub Actionsの無限ループを防ぐ。
 */
export async function triggerDeploy(): Promise<void> {
  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hookUrl) {
    throw new Error("VERCEL_DEPLOY_HOOK_URL が未設定です");
  }

  const response = await fetch(hookUrl, { method: "POST" });
  if (!response.ok) {
    throw new Error(`Deploy Hook失敗: ${response.status}`);
  }

  console.log("Vercel デプロイトリガー成功");
}
```

- [ ] **Step 2: `scripts/twitter.ts` を作成**

```typescript
// scripts/twitter.ts
import { TwitterApi } from "twitter-api-v2";
import type { DailyItem } from "./types";

function buildTweetText(date: string, items: DailyItem[]): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nukenews.vercel.app";
  const formattedDate = date.replace(/-/g, ".");
  const numbered = ["①", "②", "③", "④", "⑤"];

  const headlines = items
    .slice(0, 5)
    .map((item, i) => `${numbered[i]}「${item.newsTitle}」`)
    .join("\n");

  return `【本日の5本 📰→🔞】${formattedDate}

${headlines}

それぞれどのジャンルになったか、想像できる？👇
${siteUrl}/${date}

#ヌケニュース`;
}

/**
 * X API v2 でその日の5件まとめツイートを投稿する。
 * OAuth 1.0a（Access Token方式）を使用。
 */
export async function postDailyTweet(date: string, items: DailyItem[]): Promise<void> {
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY ?? "",
    appSecret: process.env.TWITTER_API_SECRET ?? "",
    accessToken: process.env.TWITTER_ACCESS_TOKEN ?? "",
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET ?? "",
  });

  const text = buildTweetText(date, items);
  await client.v2.tweet(text);
  console.log("Xへの投稿完了");
}
```

- [ ] **Step 3: コミット**

```bash
git add scripts/deploy.ts scripts/twitter.ts
git commit -m "feat: add Vercel deploy hook trigger and X API posting module"
```

---

## Task 7: バッチオーケストレーター

**Files:**
- Create: `scripts/batch.ts`
- Create: `tests/batch.test.ts`

- [ ] **Step 1: テストを先に作成**

```typescript
// tests/batch.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../scripts/rss", () => ({
  fetchArticles: vi.fn(),
}));
vi.mock("../scripts/ai", () => ({
  selectAndGenerateItems: vi.fn(),
}));
vi.mock("../scripts/fanza", () => ({
  searchProduct: vi.fn(),
}));
vi.mock("../scripts/deploy", () => ({
  triggerDeploy: vi.fn(),
}));
vi.mock("../scripts/twitter", () => ({
  postDailyTweet: vi.fn(),
}));
vi.mock("fs/promises", () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

import { runBatch } from "../scripts/batch";
import { fetchArticles } from "../scripts/rss";
import { selectAndGenerateItems } from "../scripts/ai";
import { searchProduct } from "../scripts/fanza";
import { triggerDeploy } from "../scripts/deploy";
import { postDailyTweet } from "../scripts/twitter";

beforeEach(() => {
  vi.clearAllMocks();
});

const mockArticles = [
  { title: "ニュース1", description: "概要1", link: "https://nhk.jp/1" },
];

const mockAiItems = [
  { newsTitle: "ニュース1", genreKeyword: "熟女", reason: "理由1", shareText: "シェア1" },
  { newsTitle: "ニュース2", genreKeyword: "ギャル", reason: "理由2", shareText: "シェア2" },
  { newsTitle: "ニュース3", genreKeyword: "人妻", reason: "理由3", shareText: "シェア3" },
  { newsTitle: "ニュース4", genreKeyword: "女教師", reason: "理由4", shareText: "シェア4" },
  { newsTitle: "ニュース5", genreKeyword: "痴女", reason: "理由5", shareText: "シェア5" },
];

const mockProduct = {
  title: "テスト作品",
  thumbnailUrl: "https://pics.dmm.co.jp/thumb.jpg",
  affiliateUrlSingle: "https://al.dmm.co.jp/?single",
  affiliateUrlMonthly: "https://al.dmm.co.jp/?monthly",
};

describe("runBatch", () => {
  it("全ステップを正常に実行してDailyDataを返す", async () => {
    (fetchArticles as any).mockResolvedValue(mockArticles);
    (selectAndGenerateItems as any).mockResolvedValue(mockAiItems);
    (searchProduct as any).mockResolvedValue(mockProduct);
    (triggerDeploy as any).mockResolvedValue(undefined);
    (postDailyTweet as any).mockResolvedValue(undefined);

    const result = await runBatch("2026-04-07");

    expect(result.date).toBe("2026-04-07");
    expect(result.items).toHaveLength(5);
    expect(result.items[0].id).toBe(1);
    expect(result.items[0].newsTitle).toBe("ニュース1");
    expect(result.items[0].product.title).toBe("テスト作品");

    expect(searchProduct).toHaveBeenCalledTimes(5);
    expect(triggerDeploy).toHaveBeenCalledTimes(1);
    expect(postDailyTweet).toHaveBeenCalledWith("2026-04-07", result.items);
  });

  it("RSS取得が失敗したときエラーをスロー", async () => {
    (fetchArticles as any).mockRejectedValue(new Error("RSS失敗"));

    await expect(runBatch("2026-04-07")).rejects.toThrow("RSS失敗");
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npx vitest run tests/batch.test.ts
```

Expected: FAIL with "Cannot find module '../scripts/batch'"

- [ ] **Step 3: `scripts/batch.ts` を実装**

```typescript
// scripts/batch.ts
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { fetchArticles } from "./rss";
import { selectAndGenerateItems } from "./ai";
import { searchProduct } from "./fanza";
import { triggerDeploy } from "./deploy";
import { postDailyTweet } from "./twitter";
import type { DailyData, DailyItem } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

async function saveJson(data: DailyData, date: string): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const json = JSON.stringify(data, null, 2);
  await writeFile(path.join(DATA_DIR, `${date}.json`), json, "utf-8");
  await writeFile(path.join(DATA_DIR, "latest.json"), json, "utf-8");
  console.log(`JSON保存完了: data/${date}.json, data/latest.json`);
}

/**
 * バッチ処理のメインオーケストレーター。
 * RSS取得 → AI選定・生成 → FANZA検索（並列） → JSON保存 → デプロイ → X投稿
 */
export async function runBatch(date: string): Promise<DailyData> {
  console.log(`=== バッチ開始: ${date} ===`);

  // Step 1: RSS取得
  console.log("[1/5] RSS取得中...");
  const articles = await fetchArticles();
  console.log(`  ${articles.length}件の記事を取得`);

  // Step 2: AI一括処理
  console.log("[2/5] AI選定・生成中...");
  const aiItems = await selectAndGenerateItems(articles);
  console.log(`  ${aiItems.length}件を選定`);

  // Step 3: FANZA API並列検索
  console.log("[3/5] FANZA作品検索中（並列）...");
  const products = await Promise.all(
    aiItems.map((item, i) => searchProduct(item.genreKeyword, date, i + 1))
  );

  // Step 4: DailyData組み立て＋JSON保存
  const items: DailyItem[] = aiItems.map((aiItem, i) => ({
    id: i + 1,
    newsTitle: aiItem.newsTitle,
    genre: aiItem.genreKeyword,
    reason: aiItem.reason,
    shareText: aiItem.shareText,
    product: products[i],
  }));

  const dailyData: DailyData = { date, items };

  console.log("[4/5] JSON保存中...");
  await saveJson(dailyData, date);

  // Step 5a: JSONをGitにcommit & push（Vercelのビルド時に参照するため必須）
  // GitHub ActionsはDeploy Hookでデプロイするため、git pushがVercel自動デプロイを
  // 二重トリガーしないよう vercel.json で ignoreBuildStep を設定すること（Task 17参照）
  console.log("[5a/5] データをGitにcommit & push中...");
  const { execSync } = await import("child_process");
  execSync(`git config user.email "github-actions@github.com"`);
  execSync(`git config user.name "GitHub Actions"`);
  execSync(`git add data/${date}.json data/latest.json`);
  execSync(`git commit -m "data: add daily content for ${date}" --allow-empty`);
  execSync("git push origin main");

  // Step 5b: Vercel Deploy Hookでデプロイトリガー（git pushと独立して実行）
  console.log("[5b/5] Vercelデプロイトリガー中...");
  await triggerDeploy();

  // Step 5c: X投稿
  console.log("[5c/5] X投稿中...");
  await postDailyTweet(date, items);

  console.log("=== バッチ完了 ===");
  return dailyData;
}

// スクリプトとして直接実行された場合
if (process.argv[1] && process.argv[1].endsWith("batch.ts")) {
  const today = new Date().toISOString().split("T")[0];
  runBatch(today)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("バッチ失敗:", error);
      process.exit(1);
    });
}
```

- [ ] **Step 4: テストを実行して成功を確認**

```bash
npx vitest run tests/batch.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: コミット**

```bash
git add scripts/batch.ts tests/batch.test.ts
git commit -m "feat: add batch orchestrator with RSS->AI->FANZA->deploy->X pipeline"
```

---

## Task 8: GitHub Actions ワークフロー

**Files:**
- Create: `.github/workflows/daily.yml`

- [ ] **Step 1: ワークフローファイルを作成**

```yaml
# .github/workflows/daily.yml
name: Daily Batch

on:
  schedule:
    # 毎日 UTC 22:00 = JST 07:00
    - cron: "0 22 * * *"
  workflow_dispatch:

jobs:
  batch:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    # バッチがdata/をgit pushするため書き込み権限が必要
    permissions:
      contents: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          # git pushに必要なtokenを明示
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run daily batch
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          FANZA_API_ID: ${{ secrets.FANZA_API_ID }}
          FANZA_AFFILIATE_ID: ${{ secrets.FANZA_AFFILIATE_ID }}
          FANZA_MONTHLY_AFFILIATE_URL: ${{ secrets.FANZA_MONTHLY_AFFILIATE_URL }}
          TWITTER_API_KEY: ${{ secrets.TWITTER_API_KEY }}
          TWITTER_API_SECRET: ${{ secrets.TWITTER_API_SECRET }}
          TWITTER_ACCESS_TOKEN: ${{ secrets.TWITTER_ACCESS_TOKEN }}
          TWITTER_ACCESS_TOKEN_SECRET: ${{ secrets.TWITTER_ACCESS_TOKEN_SECRET }}
          VERCEL_DEPLOY_HOOK_URL: ${{ secrets.VERCEL_DEPLOY_HOOK_URL }}
          NEXT_PUBLIC_SITE_URL: ${{ secrets.NEXT_PUBLIC_SITE_URL }}
          NEXT_PUBLIC_TWITTER_HANDLE: ${{ secrets.NEXT_PUBLIC_TWITTER_HANDLE }}
        run: npm run batch

      - name: Notify Slack on failure
        if: failure()
        uses: slackapi/slack-github-action@v1.27.0
        with:
          payload: |
            {
              "text": "🚨 ヌケニュース バッチ失敗 (${{ github.run_id }})\nhttps://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          SLACK_WEBHOOK_TYPE: INCOMING_WEBHOOK
```

> **注意:**
> - GitHub Actions Secrets に上記の全変数を設定すること
> - `SLACK_WEBHOOK_URL` は任意。未設定でも失敗通知ステップはskipされる（`if: failure()` のみ実行）
> - `permissions: contents: write` がないと `git push` が403エラーになる

- [ ] **Step 2: コミット**

```bash
mkdir -p .github/workflows
git add .github/workflows/daily.yml
git commit -m "feat: add GitHub Actions daily cron workflow"
```

---

## Task 9: データ読み込みユーティリティ

**Files:**
- Create: `src/app/lib/data.ts`

- [ ] **Step 1: `src/app/lib/data.ts` を作成**

```typescript
// src/app/lib/data.ts
import fs from "fs";
import path from "path";
import type { DailyData } from "../../../scripts/types";

const DATA_DIR = path.join(process.cwd(), "data");

/**
 * 指定日付のJSONデータを読み込む。
 * 存在しない場合はnullを返す。
 */
export function loadDailyData(date: string): DailyData | null {
  const filePath = path.join(DATA_DIR, `${date}.json`);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as DailyData;
  } catch {
    return null;
  }
}

/**
 * 最新データ（latest.json）を読み込む。フォールバック用。
 */
export function loadLatestData(): DailyData | null {
  const filePath = path.join(DATA_DIR, "latest.json");
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as DailyData;
  } catch {
    return null;
  }
}

/**
 * データディレクトリ内の全日付リストを新しい順で返す。
 */
export function listAvailableDates(): string[] {
  try {
    const files = fs.readdirSync(DATA_DIR);
    return files
      .filter((f) => f.match(/^\d{4}-\d{2}-\d{2}\.json$/))
      .map((f) => f.replace(".json", ""))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: コミット**

```bash
git add src/app/lib/data.ts
git commit -m "feat: add data loading utilities for SSG"
```

---

## Task 10: NewsCard コンポーネント

**Files:**
- Create: `src/app/components/NewsCard.tsx`
- Create: `tests/components/NewsCard.test.tsx`

- [ ] **Step 1: テストを先に作成**

```typescript
// tests/components/NewsCard.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { NewsCard } from "../../src/app/components/NewsCard";
import type { DailyItem } from "../../scripts/types";

const mockItem: DailyItem = {
  id: 1,
  newsTitle: "日銀、金利据え置きを決定",
  genre: "熟女",
  reason: "長年の経験で培った安定した手さばきが今の日本経済に重なった。",
  shareText: "このニュースで選ばれた作品、絶対わからんと思う。",
  product: {
    title: "テスト作品",
    thumbnailUrl: "https://pics.dmm.co.jp/thumb.jpg",
    affiliateUrlSingle: "https://al.dmm.co.jp/?single&utm_source=nukenews",
    affiliateUrlMonthly: "https://al.dmm.co.jp/?monthly&utm_source=nukenews",
  },
};

describe("NewsCard", () => {
  it("ニュースタイトルを表示する", () => {
    render(<NewsCard item={mockItem} date="2026-04-07" />);
    expect(screen.getByText("日銀、金利据え置きを決定")).toBeInTheDocument();
  });

  it("理由文を表示する", () => {
    render(<NewsCard item={mockItem} date="2026-04-07" />);
    expect(screen.getByText(/安定した手さばき/)).toBeInTheDocument();
  });

  it("FANZAの単品CTAリンクを表示する", () => {
    render(<NewsCard item={mockItem} date="2026-04-07" />);
    const singleLink = screen.getByText(/FANZAで確認する/);
    expect(singleLink.closest("a")).toHaveAttribute(
      "href",
      "https://al.dmm.co.jp/?single&utm_source=nukenews"
    );
  });

  it("FANZAの月額CTAリンクを表示する", () => {
    render(<NewsCard item={mockItem} date="2026-04-07" />);
    const monthlyLink = screen.getByText(/月額で見放題/);
    expect(monthlyLink.closest("a")).toHaveAttribute(
      "href",
      "https://al.dmm.co.jp/?monthly&utm_source=nukenews"
    );
  });

  it("Xシェアリンクにティザーテキストが含まれる", () => {
    render(<NewsCard item={mockItem} date="2026-04-07" />);
    const shareLink = screen.getByText(/シェア/);
    const href = shareLink.closest("a")?.getAttribute("href") ?? "";
    expect(href).toContain("twitter.com/intent/tweet");
    expect(href).toContain(encodeURIComponent("このニュースで選ばれた作品"));
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npx vitest run tests/components/NewsCard.test.tsx
```

Expected: FAIL with "Cannot find module '../../src/app/components/NewsCard'"

- [ ] **Step 3: `src/app/components/NewsCard.tsx` を実装**

```tsx
// src/app/components/NewsCard.tsx
import Image from "next/image";
import type { DailyItem } from "../../../scripts/types";

interface NewsCardProps {
  item: DailyItem;
  date: string;
}

export function NewsCard({ item, date }: NewsCardProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nukenews.vercel.app";
  const itemUrl = `${siteUrl}/${date}#item-${item.id}`;

  const tweetText = encodeURIComponent(
    `${item.shareText}\n\nせっかくだから俺はこのニュースで抜くぜ\n${itemUrl}\n#ヌケニュース`
  );
  const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;

  return (
    <article
      id={`item-${item.id}`}
      className="bg-white rounded-2xl shadow-md overflow-hidden mb-6"
    >
      {/* カード番号 + ニュースタイトル */}
      <div className="px-4 pt-4 pb-2">
        <span className="text-xs font-bold text-gray-400">#{item.id}</span>
        <h2 className="text-base font-bold text-gray-900 mt-1 leading-snug">
          {item.newsTitle}
        </h2>
      </div>

      {/* 作品サムネイル */}
      <div className="relative w-full aspect-video bg-gray-100">
        <Image
          src={item.product.thumbnailUrl}
          alt={item.product.title}
          fill
          className="object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/fallback-thumb.png";
          }}
          unoptimized={item.product.thumbnailUrl.startsWith("/fallback")}
        />
      </div>

      {/* 作品タイトル + 理由文 */}
      <div className="px-4 py-3">
        <p className="text-xs text-gray-500 font-medium mb-1">{item.product.title}</p>
        <p className="text-sm text-gray-700 leading-relaxed">{item.reason}</p>
      </div>

      {/* CTA ボタン群 */}
      <div className="px-4 pb-4 flex flex-col gap-2">
        <a
          href={item.product.affiliateUrlSingle}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold py-3 rounded-xl transition-colors"
        >
          🔞 FANZAで確認する
        </a>
        <a
          href={item.product.affiliateUrlMonthly}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
        >
          📺 月額で見放題にする
        </a>
        <a
          href={tweetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center bg-black hover:bg-gray-800 text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
        >
          𝕏 シェア
        </a>
      </div>
    </article>
  );
}
```

- [ ] **Step 4: テストを実行して成功を確認**

```bash
npx vitest run tests/components/NewsCard.test.tsx
```

Expected: PASS (5 tests)

- [ ] **Step 5: コミット**

```bash
git add src/app/components/NewsCard.tsx tests/components/NewsCard.test.tsx
git commit -m "feat: add NewsCard component with dual CTA and X share"
```

---

## Task 11: Header と ArchiveList コンポーネント

**Files:**
- Create: `src/app/components/Header.tsx`
- Create: `src/app/components/ArchiveList.tsx`
- Create: `tests/components/ArchiveList.test.tsx`

- [ ] **Step 1: `ArchiveList` テストを先に作成**

```typescript
// tests/components/ArchiveList.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ArchiveList } from "../../src/app/components/ArchiveList";

describe("ArchiveList", () => {
  it("日付リストをリンクとして表示する", () => {
    const dates = ["2026-04-07", "2026-04-06", "2026-04-05"];
    render(<ArchiveList dates={dates} />);

    expect(screen.getByText("2026-04-07")).toBeInTheDocument();
    expect(screen.getByText("2026-04-06")).toBeInTheDocument();
    expect(screen.getByText("2026-04-05")).toBeInTheDocument();
  });

  it("日付リストが空のとき何も表示しない", () => {
    const { container } = render(<ArchiveList dates={[]} />);
    expect(container.querySelector("a")).toBeNull();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npx vitest run tests/components/ArchiveList.test.tsx
```

Expected: FAIL

- [ ] **Step 3: `src/app/components/Header.tsx` を作成**

```tsx
// src/app/components/Header.tsx
import Link from "next/link";

interface HeaderProps {
  date: string;
}

export function Header({ date }: HeaderProps) {
  const twitterHandle = process.env.NEXT_PUBLIC_TWITTER_HANDLE ?? "nukenews_jp";
  const formattedDate = date.replace(/-/g, ".");

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
      <div className="max-w-lg mx-auto px-4 py-3">
        <Link href="/" className="block">
          <h1 className="text-sm font-black text-gray-900 leading-tight">
            せっかくだから俺は
            <br />
            このニュースで抜くぜ
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">{formattedDate} の5本</p>
        </Link>
        <a
          href={`https://twitter.com/${twitterHandle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center gap-1.5 text-xs text-sky-600 font-bold"
        >
          <span>𝕏</span>
          <span>@{twitterHandle} をフォローして毎日受け取る</span>
        </a>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: `src/app/components/ArchiveList.tsx` を作成**

```tsx
// src/app/components/ArchiveList.tsx
import Link from "next/link";

interface ArchiveListProps {
  dates: string[];
}

export function ArchiveList({ dates }: ArchiveListProps) {
  if (dates.length === 0) return null;

  return (
    <section className="mt-8 px-4 pb-8">
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
        📅 過去のアーカイブ
      </h2>
      <div className="flex flex-wrap gap-2">
        {dates.map((date) => (
          <Link
            key={date}
            href={`/${date}`}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-colors"
          >
            {date}
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: テストを実行して成功を確認**

```bash
npx vitest run tests/components/ArchiveList.test.tsx
```

Expected: PASS (2 tests)

- [ ] **Step 6: コミット**

```bash
git add src/app/components/Header.tsx src/app/components/ArchiveList.tsx tests/components/ArchiveList.test.tsx
git commit -m "feat: add Header and ArchiveList components"
```

---

## Task 12: OGP 画像生成 API Route

**Files:**
- Create: `src/app/api/og/route.tsx`

- [ ] **Step 1: `@vercel/og` をインストール**

```bash
npm install @vercel/og
```

- [ ] **Step 2: `src/app/api/og/route.tsx` を作成**

```tsx
// src/app/api/og/route.tsx
import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import { loadDailyData } from "../../lib/data";

// Edge RuntimeはNode.js fsが使えないためnodejsランタイムを使用
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? "";
  const id = parseInt(searchParams.get("id") ?? "1", 10);

  const data = loadDailyData(date);
  const item = data?.items.find((i) => i.id === id);

  const newsTitle = item?.newsTitle ?? "せっかくだからこのニュースで抜くぜ";
  const thumbnailUrl = item?.product.thumbnailUrl ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#111827",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 背景サムネ（薄く） */}
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.15,
            }}
          />
        )}

        {/* ニュースタイトル */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            padding: "40px 80px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: "24px",
              color: "#9CA3AF",
              marginBottom: "20px",
              fontFamily: "sans-serif",
            }}
          >
            このニュース
          </p>
          <p
            style={{
              fontSize: "52px",
              fontWeight: "bold",
              color: "#FFFFFF",
              lineHeight: 1.3,
              fontFamily: "sans-serif",
            }}
          >
            {newsTitle}
          </p>
          <p
            style={{
              fontSize: "22px",
              color: "#F87171",
              marginTop: "32px",
              fontFamily: "sans-serif",
            }}
          >
            せっかくだから俺はこのニュースで抜くぜ
          </p>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
```

- [ ] **Step 3: コミット**

```bash
git add src/app/api/og/route.tsx
git commit -m "feat: add OGP image generation edge function"
```

---

## Task 13: トップページ

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: `src/app/page.tsx` を実装**

```tsx
// src/app/page.tsx
import type { Metadata } from "next";
import { loadLatestData, listAvailableDates } from "./lib/data";
import { Header } from "./components/Header";
import { NewsCard } from "./components/NewsCard";
import { ArchiveList } from "./components/ArchiveList";

export async function generateMetadata(): Promise<Metadata> {
  const data = loadLatestData();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nukenews.vercel.app";
  const date = data?.date ?? new Date().toISOString().split("T")[0];
  const firstTitle = data?.items[0]?.newsTitle ?? "";

  return {
    title: `「${firstTitle}」で抜く — せっかくだから俺はこのニュースで抜くぜ`,
    description: data?.items[0]?.reason ?? "今日のニュースをAVジャンルに変換しました",
    openGraph: {
      title: "せっかくだから俺はこのニュースで抜くぜ",
      description: "今日のニュースがどのAVジャンルになるか、見てみないとわかりません。",
      images: [{ url: `${siteUrl}/api/og?date=${date}&id=1` }],
      url: siteUrl,
    },
    twitter: {
      card: "summary_large_image",
      images: [`${siteUrl}/api/og?date=${date}&id=1`],
    },
  };
}

export default function HomePage() {
  const data = loadLatestData();
  const dates = listAvailableDates();
  const today = data?.date ?? new Date().toISOString().split("T")[0];

  return (
    <main className="bg-gray-50 min-h-screen">
      <Header date={today} />
      <div className="max-w-lg mx-auto px-4 pt-4">
        {data && data.items.length > 0 ? (
          data.items.map((item) => (
            <NewsCard key={item.id} item={item} date={today} />
          ))
        ) : (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-4">📰</p>
            <p className="text-sm">本日のコンテンツは準備中です</p>
          </div>
        )}
        <ArchiveList dates={dates.filter((d) => d !== today)} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add src/app/page.tsx
git commit -m "feat: add top page with latest daily content"
```

---

## Task 14: アーカイブページ

**Files:**
- Create: `src/app/[date]/page.tsx`

- [ ] **Step 1: `src/app/[date]/page.tsx` を作成**

```tsx
// src/app/[date]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadDailyData, listAvailableDates } from "../lib/data";
import { Header } from "../components/Header";
import { NewsCard } from "../components/NewsCard";
import { ArchiveList } from "../components/ArchiveList";

interface PageProps {
  params: Promise<{ date: string }>;
}

export async function generateStaticParams() {
  const dates = listAvailableDates();
  return dates.map((date) => ({ date }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params;
  const data = loadDailyData(date);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nukenews.vercel.app";

  if (!data) {
    return { title: "Not Found" };
  }

  const firstTitle = data.items[0]?.newsTitle ?? "";

  return {
    title: `${date}「${firstTitle}」他 — せっかくだから俺はこのニュースで抜くぜ`,
    description: data.items.map((i) => i.newsTitle).join("、"),
    openGraph: {
      title: `${date}のヌケニュース`,
      images: [{ url: `${siteUrl}/api/og?date=${date}&id=1` }],
      url: `${siteUrl}/${date}`,
    },
    twitter: {
      card: "summary_large_image",
      images: [`${siteUrl}/api/og?date=${date}&id=1`],
    },
  };
}

export default async function DatePage({ params }: PageProps) {
  const { date } = await params;
  const data = loadDailyData(date);

  if (!data) {
    notFound();
  }

  const allDates = listAvailableDates();

  return (
    <main className="bg-gray-50 min-h-screen">
      <Header date={date} />
      <div className="max-w-lg mx-auto px-4 pt-4">
        {data.items.map((item) => (
          <NewsCard key={item.id} item={item} date={date} />
        ))}
        <ArchiveList dates={allDates.filter((d) => d !== date)} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add "src/app/[date]/page.tsx"
git commit -m "feat: add date archive page with SSG"
```

---

## Task 15: ルートレイアウト

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: `src/app/globals.css` を更新**

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

html {
  -webkit-text-size-adjust: 100%;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif;
}
```

- [ ] **Step 2: `src/app/layout.tsx` を更新**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "せっかくだから俺はこのニュースで抜くぜ",
  description: "今日のニュースをAVジャンルに変換しました。見てみないとわかりません。",
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: `@vercel/analytics` をインストール**

```bash
npm install @vercel/analytics
```

- [ ] **Step 4: コミット**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: add root layout with Vercel Analytics"
```

---

## Task 16: フォールバック画像とビルド確認

**Files:**
- Create: `public/fallback-thumb.png`（1x1の灰色PNG）

- [ ] **Step 1: フォールバック画像を作成**

`public/fallback-thumb.png` に300x169px の灰色画像を配置する。
任意の画像編集ツール（またはonline PNG generatorサービス）で `#CCCCCC` 単色の画像を作成し `public/fallback-thumb.png` として保存する。

- [ ] **Step 2: テストを全件実行**

```bash
npm run test
```

Expected: 全テスト PASS

- [ ] **Step 3: ビルドを実行（型エラー・Lintエラーを確認）**

```bash
npm run build
```

Expected: ビルド成功（警告は可、エラーは修正）

- [ ] **Step 4: ローカル動作確認**

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開き、以下を確認：
- サイト名が表示される
- `data/latest.json` が空のとき「本日のコンテンツは準備中です」と表示される

- [ ] **Step 5: 最終コミット**

```bash
git add public/fallback-thumb.png
git commit -m "feat: add fallback thumbnail image"
```

---

## Task 17: Vercel デプロイ

- [ ] **Step 1: GitHubリポジトリを作成してpush**

```bash
# GitHubでリポジトリ作成後
git remote add origin https://github.com/YOUR_USERNAME/nuke-news.git
git push -u origin main
```

- [ ] **Step 2: Vercelにプロジェクトをインポート**

1. vercel.com にログイン
2. "New Project" > GitHubリポジトリを選択
3. Framework: Next.js（自動検出）
4. Environment Variables を設定（`.env.example` の全項目）
5. Deploy

- [ ] **Step 3: Vercel Deploy Hook URLを取得**

1. Vercel Dashboard > プロジェクト > Settings > Git
2. "Deploy Hooks" セクション > "Create Hook"
3. Hook名: `daily-batch`、ブランチ: `main`
4. 生成されたURLを GitHub Secrets の `VERCEL_DEPLOY_HOOK_URL` に設定

- [ ] **Step 4: GitHub Secrets を全項目設定**

リポジトリ > Settings > Secrets and variables > Actions で以下を設定：
- `ANTHROPIC_API_KEY`
- `FANZA_API_ID`
- `FANZA_AFFILIATE_ID`
- `FANZA_MONTHLY_AFFILIATE_URL`
- `TWITTER_API_KEY`
- `TWITTER_API_SECRET`
- `TWITTER_ACCESS_TOKEN`
- `TWITTER_ACCESS_TOKEN_SECRET`
- `VERCEL_DEPLOY_HOOK_URL`
- `NEXT_PUBLIC_SITE_URL`（例: `https://nuke-news.vercel.app`）
- `NEXT_PUBLIC_TWITTER_HANDLE`（例: `nukenews_jp`）

- [ ] **Step 5: GitHub Actions を手動実行してバッチ動作確認**

GitHub > Actions > "Daily Batch" > "Run workflow" で手動実行。
ログを確認し、全ステップが成功することを確認。

---

## Task 18: SEO基盤（sitemap + robots.txt）

**Files:**
- Create: `src/app/sitemap.ts`
- Create: `src/app/robots.ts`
- Create: `vercel.json`

- [ ] **Step 1: `src/app/sitemap.ts` を作成**

Next.jsの`MetadataRoute.Sitemap`を使い、全日付ページを自動列挙する。

```typescript
// src/app/sitemap.ts
import type { MetadataRoute } from "next";
import { listAvailableDates } from "./lib/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nukenews.vercel.app";
  const dates = listAvailableDates();

  const archiveUrls: MetadataRoute.Sitemap = dates.map((date) => ({
    url: `${siteUrl}/${date}`,
    lastModified: new Date(date),
    changeFrequency: "yearly",
    priority: 0.7,
  }));

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    ...archiveUrls,
  ];
}
```

- [ ] **Step 2: `src/app/robots.ts` を作成**

```typescript
// src/app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nukenews.vercel.app";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
```

- [ ] **Step 3: `vercel.json` を作成**

`data/` フォルダのみの変更（バッチのgit push）でVercelの自動デプロイが起動しないよう設定する。
デプロイはDeploy Hook経由のみで行う。

```json
// vercel.json
{
  "git": {
    "deploymentEnabled": {
      "main": false
    }
  }
}
```

> **重要:** この設定により `git push` はVercelの自動デプロイをトリガーしない。
> デプロイは `scripts/deploy.ts` が呼ぶ Deploy Hook のみで実行される。
> Vercel Dashboard で Deploy Hook を作成し `VERCEL_DEPLOY_HOOK_URL` に設定すること。

- [ ] **Step 4: テストを実行（全件）**

```bash
npm run test
```

Expected: 全テスト PASS

- [ ] **Step 5: ビルドを実行**

```bash
npm run build
```

Expected: ビルド成功。`/sitemap.xml` と `/robots.txt` が生成されていることを確認。

- [ ] **Step 6: コミット**

```bash
git add src/app/sitemap.ts src/app/robots.ts vercel.json
git commit -m "feat: add sitemap, robots.txt, and Vercel deploy configuration"
git push origin main
```

---

## セルフレビューチェック

- [x] **RSSモジュール:** 複数ソース + フォールバック実装済み
- [x] **AI一括処理:** 選定・ジャンル・理由文・シェアテキストを1プロンプトで生成
- [x] **FANZA API:** 新作優先（date sort）→ 0件なら人気順（rankprofile）フォールバック + UTMパラメーター付与
- [x] **バッチ git flow:** JSON生成 → git commit & push → Deploy Hook（順序が重要）
- [x] **vercel.json:** git pushによる自動デプロイ無効化（Deploy Hook専用）
- [x] **GitHub Actions permissions:** `contents: write` で git push 権限付与
- [x] **Slack失敗通知:** `if: failure()` で webhook通知
- [x] **X API:** OAuth 1.0a（twitter-api-v2使用）
- [x] **バッチオーケストレーター:** 全ステップ統合 + JSON保存（latest.json含む）
- [x] **Next.js SSG:** トップページ + アーカイブページ + generateStaticParams
- [x] **OGP画像:** `runtime = "nodejs"`（Edge Runtimeはfsモジュールが使えないため）
- [x] **sitemap.xml:** 全日付ページを自動列挙（SEO資産）
- [x] **robots.txt:** 全クローラー許可 + sitemapURL指定
- [x] **収益設計:** 単品CTA + 月額CTA + UTMパラメーター
- [x] **Xフォロー誘導:** Header内に配置
- [x] **ティザーシェア:** 作品名を含まないシェアテキスト生成
- [x] **Vercel Analytics:** layout.tsxに統合
- [x] **型整合性:** `DailyItem`, `DailyData`, `FanzaProduct`が全タスク共通
- [x] **テスト:** rss / ai / fanza / batch / NewsCard / ArchiveList をカバー
- [x] **リポジトリ:** https://github.com/temunto-png/Nuke-News.git（既存、git cloneから開始）
