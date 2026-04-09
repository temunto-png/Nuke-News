# Nuke News 全面ブラッシュアップ 設計書 (Rev.2)

**作成日:** 2026-04-08  
**背景:** DMMアフィリエイト審査不承認（コンテンツ不足）を契機に、審査通過・収益起動・CVR最大化・成長加速を整備する。  
**Rev.2:** hostile review 指摘事項を反映。責務分離・障害復旧可能性を優先した実装順に組み替え。

---

## 現状の問題点

| 深刻度 | 問題 | 場所 |
|--------|------|------|
| 🔴 致命的 | `affiliateUrlSingle/Monthly` が全件 `""` → CTAクリック無効・収益ゼロ | `data/2026-04-08.json`, `fanza.ts:55` |
| 🔴 致命的 | データ1日分しかない → DMMアフィリエイト審査不承認の直接原因 | `data/` |
| 🔴 致命的 | About・プライバシーポリシーページがない → 審査で「方向性不明」と判断 | `src/app/` |
| 🔴 致命的 | `runBatch` が生成・保存・deploy・tweet を同時実行 → seed から呼ぶと14回誤発火 | `scripts/batch.ts` |
| 🟠 重大 | 文字化けが layout.tsx / og/route.tsx / twitter.ts に存在 → 審査・SEO・SNS全接点が傷つく | 複数ファイル |
| 🟠 重大 | フォールバック時 `reason` が全件同一テキスト | `ai.ts:38` |
| 🟠 重大 | 5件中4件が「人妻」ジャンル → バリエーション欠如 | `ai.ts:34` |
| 🟡 中程度 | CTAコピーが弱い（「FANZAで確認する」等） | `NewsCard.tsx:53` |
| 🟡 中程度 | バッチ冪等性なし（date.jsonの存在チェックだけでは部分失敗を永久化） | `batch.ts` |
| 🟡 中程度 | X投稿でニュースタイトルを列挙 → ティザー戦略を自ら破壊 | `twitter.ts:4` |

### affiliateUrl空問題の根本原因

`FANZA_MONTHLY_AFFILIATE_URL` が未設定または空文字列の場合:

```
getFallbackProduct → appendTrackingParams("", ...) → new URL("") throws → catch で "" を return
```

`appendTrackingParams` の catch が `url` をそのまま返す設計のため、空文字列が伝播する。

---

## アーキテクチャ方針

- 既存のバッチ→JSON→SSG→Vercelアーキテクチャを維持
- DBなし・git管理のJSONデータストアは維持
- ただし「索引を持たない」制約は持たない。batch時に `genre-index.json` を生成する

### runBatch 責務分離（全Phase共通の前提）

現行 `runBatch` は以下を同時実行している:

```
generateDailyData  → RSSフェッチ・AI選定・FANZA API
persistDailyData   → date.json・latest.json の書き込み
publishDailyData   → deploy hook・tweet
```

これを3つの独立した関数に分離する。`seed.ts` は `generateDailyData` + `persistDailyData` のみ呼び出し、`publishDailyData` は呼ばない。

### 冪等性の正しい設計

`date.json` の存在チェックだけでは部分失敗（JSON書けたがtweet失敗等）を永久化する。

**解決策:** `data/status.json` を導入し、各日付の処理ステータスを記録する。

```json
{
  "2026-04-08": {
    "generated": true,
    "persisted": true,
    "deployed": true,
    "tweeted": false
  }
}
```

- `generateDailyData` はステータスに関係なく再実行可能（生成は冪等）
- `persistDailyData` は `persisted: true` の場合スキップ
- `publishDailyData` は `deployed/tweeted` それぞれ個別に再試行可能

### latest.json の扱い

- `persistDailyData` に `{ updateLatest: boolean }` オプションを持たせる
- backfill（seed）では `updateLatest: false` で実行し、トップページ表示が過去に巻き戻ることを防ぐ
- 通常の日次バッチのみ `updateLatest: true`

### FanzaProduct型の拡張

fallback判定をUI層の `thumbnailUrl` 比較に依存させると、「実在商品だが画像URL不正」のケースで誤判定する。

```ts
// scripts/types.ts に追加
interface FanzaProduct {
  title: string;
  thumbnailUrl: string;
  affiliateUrlSingle: string;
  affiliateUrlMonthly: string;
  isFallback: boolean;  // 追加: true = FANZA API未取得
}
```

CTA文言の分岐は `isFallback` フラグのみに基づく。

### genre-index.json の事前生成

`data/*.json` 全走査をrequest/build時に行わない。batch時に索引を更新する。

```json
// data/genre-index.json
{
  "人妻": [
    { "date": "2026-04-08", "itemId": 2 },
    { "date": "2026-04-07", "itemId": 1 }
  ],
  "OL": [...]
}
```

`listDatesByGenre` は `genre-index.json` を読むだけ。

---

## 実装フェーズ（障務境界に沿って分割）

ビジネス目標（審査通過・収益起動等）はロードマップとして維持するが、実装タスクは障害境界で切る。

### Phase 0: 文字化け修正

**ゴール:** 審査・SNS・OGP・SEOの全接点から文字化けを除去する。他の全Phaseの前提。

**対象ファイル:**
- `src/app/layout.tsx` — metadata の文字化け
- `src/app/api/og/route.tsx` — フォールバック文言の文字化け
- `scripts/twitter.ts` — 投稿文面の文字化け

**進め方:** まず文字化けがファイル保存時の問題かターミナル表示だけの問題かを切り分ける。

**KPI:** 各ファイルで日本語が正しく表示されること。

---

### Phase 1: runBatch 責務分離

**ゴール:** `generateDailyData` / `persistDailyData` / `publishDailyData` を独立した関数に切り出す。

**変更ファイル:** `scripts/batch.ts`

**変更内容:**
```ts
// 分離後の呼び出しイメージ
async function runBatch(date: string) {
  const data = await generateDailyData(date);
  await persistDailyData(date, data, { updateLatest: true });
  await publishDailyData(date, data);
}
```

**KPI:** 各関数が独立してテスト・呼び出し可能なこと。

---

### Phase 2: backfill/seed 専用経路の追加

**ゴール:** 過去14日分のデータを deploy/tweet なしで安全に生成できる。

**新規ファイル:** `scripts/seed.ts`

```ts
// seed.ts の呼び出しイメージ
for (const date of last14Days()) {
  if (statusFile.get(date)?.persisted) continue;
  const data = await generateDailyData(date);
  await persistDailyData(date, data, { updateLatest: false });
}
```

**`data/status.json` 新規作成:** 各日付の処理ステータスを記録。

**KPI:** seed実行後に deploy/tweet が走らないこと・`latest.json` が更新されないこと。

---

### Phase 3: fallbackデータモデル化 + affiliateUrlバグ修正

**ゴール:** fallback状態をデータモデルで明示し、UIとビジネスロジックの分離を実現する。

**変更ファイル:**
- `scripts/types.ts` — `FanzaProduct` に `isFallback: boolean` を追加
- `scripts/fanza.ts` — `getFallbackProduct` 修正・`isFallback: true` をセット
- `src/app/components/NewsCard.tsx` — CTA分岐を `isFallback` フラグに基づかせる

**`fanza.ts` のバグ修正:**
```ts
// 修正前
const defaultUrl = process.env.FANZA_MONTHLY_AFFILIATE_URL ?? "https://www.dmm.co.jp/digital/videoa/";

// 修正後
const rawUrl = process.env.FANZA_MONTHLY_AFFILIATE_URL?.trim();
const defaultUrl = rawUrl && rawUrl.length > 0
  ? rawUrl
  : "https://www.dmm.co.jp/digital/videoa/-/list/=/";
```

**KPI:** `isFallback: true` のカードで CTA が「今日の作品を探す →」と表示されること。`isFallback: false` では通常CTAが表示されること。

---

### Phase 4: About / Privacy / Footer 追加

**ゴール:** DMMアフィリエイト審査担当者がサイトの方向性を判断できる状態にする。

**新規ファイル:**
- `src/app/about/page.tsx`
- `src/app/privacy/page.tsx`
- `src/app/components/Footer.tsx`

**変更ファイル:** `src/app/layout.tsx`

**About ページ内容:**
- サイトの趣旨（ニュース×AVジャンルのユーモアサイト）
- 更新頻度（毎朝JST 7時自動更新）
- 成人向けコンテンツへのリンクを含む旨の免責
- FANZAアフィリエイト掲載の明示

**Privacy ページ内容:**
- アクセス解析（Vercel Analytics）の利用
- アフィリエイトリンクの利用
- Cookieの利用
- お問い合わせ先（X @ハンドル）

**KPI:** `/about`・`/privacy` がビルドで生成されること。フッターに両ページへのリンクがあること。

---

### Phase 5: CTA / OGP / metadata の改善

**ゴール:** CVRに直結するUI・コンテンツ品質を上げる。

**`scripts/ai.ts` — ジャンル多様性改善（soft constraint）**

「全件異なる」は hard requirement にしない。代わりに:
- 同一ジャンル偏重を避けるsoft constraint をAIプロンプトに追加
- `buildFallbackItems` のジャンルローテーション実装

```ts
const FALLBACK_GENRES = ["人妻", "OL", "ギャル", "お姉さん", "制服", "熟女", "巨乳"];
// インデックスでローテーション（同一ジャンル重複を減らす）
```

**AIプロンプト追加指示:**
```
- できるだけ異なる genreKeyword を使うこと（ただし検索ヒット率を優先）
```

**`scripts/ai.ts` — reason品質向上**

フォールバックの `reason` をタイトルを使ったテンプレートに変更:
```ts
const REASON_TEMPLATES = [
  (title: string, genre: string) =>
    `「${title}」というニュースが${genre}に繋がる理由、考えれば考えるほど笑える。`,
  (title: string, genre: string) =>
    `担当AIが「${title}」を読んで最初に思い浮かべたのが${genre}だったらしい。`,
  (title: string, genre: string) =>
    `「${title}」のどこかに${genre}の匂いがするという。AIに聞いてもはぐらかされた。`,
];
```

**`src/app/api/og/route.tsx` — OGP画像改善**

ジャンル名を「???」で隠したティザー演出に変更:
```
ニュースタイトル（上部）
???（赤い大きな文字、中央）
「答えはサイトで」（下部）
```

**`src/app/page.tsx` — メタデータ改善**
```ts
// 固定キャッチコピーに変更
description: "今日のニュース5本が、AIによって全く別のジャンルに変換されました。答えはサイトで。"
```

**`src/app/components/NewsCard.tsx` — CTAコピー強化**

| 現状 | 改善後 |
|------|--------|
| 「FANZAで確認する」 | 「作品を見る →」 |
| 「月額で見放題にする」 | 「月額プランで全部見放題にする」 |

**KPI:**
- FANZA API成功率（バッチログから計測）
- fallbackRate = fallback商品数 / 全商品数
- フォールバックreasonが全件異なること

---

### Phase 6: ジャンルアーカイブ / サイトマップ

**ゴール:** SEOによる自然流入とXティザー戦略強化。

**`scripts/batch.ts` — genre-index.json 更新**

`persistDailyData` 内で `data/genre-index.json` を更新:
```ts
// genre-index.json の更新ロジック（既存エントリを保持しつつ当日分を追記）
```

**`src/app/lib/data.ts` — listDatesByGenre 追加**
```ts
export function listDatesByGenre(genre: string): Array<{ date: string; itemId: number }> {
  const index = readGenreIndex();
  return index[genre] ?? [];
}
```

**新規ファイル:**
- `src/app/genre/[genre]/page.tsx` — ジャンル別アーカイブページ
- `src/app/sitemap.ts` — サイトマップ自動生成（全URL対象）

**`scripts/twitter.ts` — 投稿フォーマット刷新**

タイトル列挙をやめ、ティザー型に変更:
```
今日の5本、ジャンルが全部ずれてる 📰→🔞

政治・経済・事件・スポーツ・国際
それぞれ何のジャンルに変換されたか

答えは↓
https://nukenews.vercel.app/YYYY-MM-DD

#ヌケニュース
```

ニュースカテゴリ推定は既存 `inferGenreKeyword` ロジックを流用。

**KPI:**
- tweet → site CTR（Xアナリティクスで計測）
- sitemap が全URLを含むこと
- ジャンルページが `genre-index.json` から生成されていること（`data/*.json` 全走査なし）

---

## 全体変更ファイル一覧

| Phase | 新規 | 変更 |
|-------|------|------|
| 0 | — | `src/app/layout.tsx`, `src/app/api/og/route.tsx`, `scripts/twitter.ts` |
| 1 | — | `scripts/batch.ts` |
| 2 | `scripts/seed.ts`, `data/status.json` | — |
| 3 | — | `scripts/types.ts`, `scripts/fanza.ts`, `src/app/components/NewsCard.tsx` |
| 4 | `src/app/about/page.tsx`, `src/app/privacy/page.tsx`, `src/app/components/Footer.tsx` | `src/app/layout.tsx` |
| 5 | — | `scripts/ai.ts`, `src/app/api/og/route.tsx`, `src/app/page.tsx`, `src/app/components/NewsCard.tsx` |
| 6 | `src/app/genre/[genre]/page.tsx`, `src/app/sitemap.ts` | `scripts/batch.ts`, `src/app/lib/data.ts`, `scripts/twitter.ts` |

## ビジネスマイルストーン

| マイルストーン | 必要なPhase |
|--------------|------------|
| DMMアフィリエイト再申請 | Phase 0〜4 完了後 |
| 収益起動（審査通過後） | FANZA環境変数設定 → Phase 3修正で即起動 |
| CVR最大化 | Phase 5 完了後 |
| SEO・X成長 | Phase 6 完了後 |

## 運用KPI（先行指標）

| KPI | 計測場所 | 目標 |
|-----|---------|------|
| FANZA API成功率 | バッチログ | >90% |
| fallbackRate | バッチログ | <20% |
| tweet → site CTR | Xアナリティクス | 計測開始後に目標設定 |
| data build duration | Vercel build log | <30秒 |

## 実装ガードレール

- `runBatch` を seed から直接呼ばない
- `date.json exists => skip` を冪等性と呼ばない（`status.json` で管理）
- request/build時に `data/*.json` 全走査しない（`genre-index.json` 経由）
- UI で fallback を `thumbnailUrl` から推測しない（`isFallback` フラグを使う）
- 文字化けを後回しにしない（Phase 0 が全Phaseの前提）
