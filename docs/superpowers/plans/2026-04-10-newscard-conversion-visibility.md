# NewsCard 変換可視化リデザイン Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `NewsCard` コンポーネントの情報順序とスタイルを変更し、「AIがニュースをAVジャンルに変換した」という因果の流れを視覚的に明示する。

**Architecture:** `src/app/components/NewsCard.tsx` 1ファイルのみ変更。ロジック・データ・型定義は変更しない。セクションを「ニュースタイトル → 変換セクション（区切り帯 + reason + genreバッジ）→ 作品セクション → CTA」の順に並べ替える。

**Tech Stack:** React, Next.js (App Router), Tailwind CSS, Vitest + React Testing Library

---

### Task 1: テストを更新して新しい構造をアサートする

**Files:**
- Modify: `tests/components/NewsCard.test.tsx`

- [ ] **Step 1: 区切り帯テキストのテストを追加する**

`tests/components/NewsCard.test.tsx` の `describe("NewsCard", () => {` ブロック内に以下を追加：

```tsx
it("変換区切り帯を表示する", () => {
  render(<NewsCard item={item} date="2026-04-07" />);
  expect(screen.getByText(/AIが変換すると…/)).toBeInTheDocument();
});
```

- [ ] **Step 2: genreバッジの表示テキストテストを更新する**

既存テストに genre バッジのテストが存在しないため、新規追加する：

```tsx
it("変換結果バッジに '変換結果：{genre}' を表示する", () => {
  render(<NewsCard item={item} date="2026-04-07" />);
  expect(screen.getByText("変換結果：熟女")).toBeInTheDocument();
});
```

- [ ] **Step 3: テストが失敗することを確認する**

```bash
cd "C:/tool/claude/Nuke News"
npm test -- --reporter=verbose tests/components/NewsCard.test.tsx
```

期待: `変換区切り帯を表示する` と `変換結果バッジに…` の2件が FAIL

---

### Task 2: NewsCard コンポーネントを実装する

**Files:**
- Modify: `src/app/components/NewsCard.tsx`

- [ ] **Step 1: ファイル全体を以下に置き換える**

```tsx
import Image from "next/image";
import React from "react";
import type { DailyItem } from "../../../scripts/types";

interface NewsCardProps {
  item: DailyItem;
  date: string;
}

function buildShareUrl(text: string, url: string) {
  const params = new URLSearchParams({
    text: `${text}\n\nせっかくだから俺はこのニュースで抜くぜ`,
    url,
  });

  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

export function NewsCard({ item, date }: NewsCardProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nukenews.vercel.app";
  const itemUrl = `${siteUrl.replace(/\/$/, "")}/${date}#item-${item.id}`;
  const tweetUrl = buildShareUrl(item.shareText, itemUrl);
  const thumbnailUrl = item.product.thumbnailUrl || "/fallback-thumb.png";

  return (
    <article
      id={`item-${item.id}`}
      className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.55)]"
    >
      {/* ヘッダー：ニュースタイトル */}
      <div className="border-b border-slate-100 bg-gradient-to-r from-red-50 via-white to-amber-50 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-500">#{item.id}</p>
        <h2 className="mt-2 text-lg font-bold leading-snug text-slate-950">{item.newsTitle}</h2>
      </div>

      {/* 変換セクション：区切り帯 → reason → genreバッジ */}
      <div className="border-b border-slate-100">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
          <p className="text-xs font-semibold tracking-wider text-slate-600">🤖 AIが変換すると…</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-base font-bold leading-relaxed text-slate-800">{item.reason}</p>
          <p className="mt-4 block w-full rounded-2xl bg-red-600 py-3 text-center text-sm font-bold text-white">
            変換結果：{item.genre}
          </p>
        </div>
      </div>

      {/* 作品セクション：サムネイル + タイトル + CTA */}
      <div className="p-5">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-100">
          <Image
            src={thumbnailUrl}
            alt={item.product.title}
            fill
            className="object-cover"
            unoptimized={thumbnailUrl.startsWith("/")}
          />
        </div>

        <p className="mt-4 text-sm font-bold text-slate-900">{item.product.title}</p>

        <div className="mt-5 grid gap-3">
          {item.product.isFallback ? (
            <a
              href={item.product.affiliateUrlMonthly}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-2xl bg-red-600 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-red-700"
            >
              今日の作品を探す →
            </a>
          ) : (
            <>
              <a
                href={item.product.affiliateUrlSingle}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl bg-red-600 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-red-700"
              >
                作品を見る →
              </a>
              <a
                href={item.product.affiliateUrlMonthly}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl bg-amber-400 px-4 py-3 text-center text-sm font-bold text-slate-900 transition hover:bg-amber-300"
              >
                月額プランで全部見放題にする
              </a>
            </>
          )}
          <a
            href={tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-slate-800"
          >
            𝕏 シェア
          </a>
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: テストを全件実行して通過を確認する**

```bash
cd "C:/tool/claude/Nuke News"
npm test -- --reporter=verbose tests/components/NewsCard.test.tsx
```

期待: 全件 PASS（7件）

- [ ] **Step 3: 型チェックとlintを通す**

```bash
cd "C:/tool/claude/Nuke News"
npm run typecheck && npm run lint
```

期待: エラーなし

- [ ] **Step 4: ビルドを通す**

```bash
cd "C:/tool/claude/Nuke News"
npm run build
```

期待: Build successful

- [ ] **Step 5: コミット**

```bash
cd "C:/tool/claude/Nuke News"
git add src/app/components/NewsCard.tsx tests/components/NewsCard.test.tsx
git commit -m "feat: show AI conversion flow explicitly in NewsCard

- Add '🤖 AIが変換すると…' divider between news and conversion result
- Move reason before thumbnail to surface punchline earlier
- Upgrade genre badge to full-width '変換結果：{genre}' block
- Strengthen reason text style (base/bold/slate-800)"
```
