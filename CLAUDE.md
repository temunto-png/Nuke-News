# Nuke News — CLAUDE.md

「せっかくだから俺はこのニュースで抜くぜ」— ニュースをAIがAVジャンルに紐付けるネタサイト。FANZAアフィリエイトで収益化し、X自動投稿で流入を自動増加させる完全自動運用モデル。

---

## ビジネスモデル（最重要）

**収益レバー（優先順）:**
1. **月額CTA** — `affiliateUrlMonthly` 経由、高単価（月額2,980円〜の成果報酬）
2. **単品CTA** — `affiliateUrlSingle` 経由、低〜中単価

**成長ループ:**
```
X自動投稿（ティザー型）→ フォロワー増加 → 毎日の自動流入 → アフィリエイトCVR → 収益
```

**KPI（優先順）:**
1. FANZA月額CTA クリック率（最重要）
2. X フォロワー数 / 投稿エンゲージメント率
3. 総PV（Vercel Analytics で計測）

**月間コスト: ~10円**（Claude Haiku APIのみ。他はすべて無料枠）

**ティザー戦略（絶対に守ること）:**
- X投稿文・`shareText` に作品名・ジャンル名を**絶対に含めない**
- 「答えはサイトに来るまでわからない」状態がCTRの源泉

---

## アーキテクチャ

```
[GitHub Actions Cron: UTC 22:00 = JST 07:00]
  ↓
[scripts/rss.ts]    RSS取得（NHK/Yahoo!/livedoor、最大50件）
  ↓
[scripts/ai.ts]     Claude Haiku で5件選定 + genreKeyword/reason/shareText 一括生成
  ↓
[scripts/fanza.ts]  FANZA API で作品検索（5件並列）+ UTMパラメーター付与
  ↓
[scripts/batch.ts]  data/YYYY-MM-DD.json + data/latest.json を書き出し
  ↓                    ↓
[scripts/deploy.ts] [scripts/twitter.ts]
Vercel Deploy Hook  X API v2 で自動投稿
（git push なし）
  ↓
[Next.js SSG]  Vercel がビルド → /、/[date] として配信
```

**データストア:** `data/` ディレクトリの JSON ファイル（DB なし）
- `data/YYYY-MM-DD.json` — 日次データ
- `data/latest.json` — フォールバック表示用（バッチ成功時に毎日上書き）

**重要な制約: バッチから git push してはならない。** Vercel の自動デプロイが有効だと無限ループになる。デプロイは Deploy Hook 経由のみ。

---

## ファイルマップ

| パス | 役割 |
|------|------|
| `scripts/types.ts` | **型の唯一の正解**。`DailyData`・`DailyItem`・`FanzaProduct` |
| `scripts/batch.ts` | バッチエントリーポイント。`runBatch(date?)` |
| `scripts/ai.ts` | Claude Haiku 選定。`selectAndGenerateItems(articles)` |
| `scripts/rss.ts` | RSS取得。`fetchArticles()` |
| `scripts/fanza.ts` | FANZA作品取得。`fetchFanzaProduct(keyword, campaign)` |
| `scripts/deploy.ts` | Deploy Hook 呼び出し。`triggerDeploy()` |
| `scripts/twitter.ts` | X投稿。`postDailyTweet(data)` |
| `src/app/lib/data.ts` | Next.jsからのデータ読み込み。`loadLatestData()` `loadDailyData(date)` |
| `src/app/components/NewsCard.tsx` | カードUI（メインの収益導線） |
| `src/app/api/og/route.tsx` | OGP画像生成（Vercel OG, nodejs runtime） |
| `data/` | JSON データストア（git 管理対象） |
| `.github/workflows/daily.yml` | 日次バッチ Cron（UTC 22:00） |

---

## 開発コマンド

```bash
npm test          # Vitest（修正後は必ず実行）
npm run build     # Next.js プロダクションビルド
npm run batch     # バッチ手動実行（環境変数要設定）
npm run dev       # 開発サーバー（localhost:3000）
npm run lint      # ESLint
npm run typecheck # tsc --noEmit
```

**フィードバックループ: 型チェック → lint → test → build の順で全通過を確認してから完了とする。**

---

## コードルール（このプロジェクト固有）

### タイムアウト
外部 HTTP リクエストには必ず `AbortSignal.timeout(ms)` を使う。`setTimeout` + `AbortController` の手動実装はタイマーリークを起こすため禁止。

```ts
// ✅ 正しい
const response = await fetch(url, { signal: AbortSignal.timeout(8000) });

// ❌ 禁止
const controller = new AbortController();
setTimeout(() => controller.abort(), 8000);
```

### 画像
`<img>` タグを直接使わない。`next/image` の `<Image fill>` を使う。ローカルパス（`/fallback-thumb.png`）には `unoptimized` を付ける。

```tsx
// ✅ 正しい
<div className="relative aspect-video overflow-hidden rounded-2xl">
  <Image src={url} alt={title} fill className="object-cover" />
</div>
```

### 外部URLのバリデーション
サーバーサイドで外部URLを `fetch` / `img src` に渡す前にホワイトリスト検証を行う（SSRF対策）。FANZA のサムネは `*.dmm.co.jp` / `*.dmm.com` のみ許可。`og/route.tsx` の `isSafeThumbnailUrl()` を参照。

### UTMパラメーター形式
```
utm_source=nukenews
utm_medium=card
utm_campaign={YYYY-MM-DD}-item{N}-{single|monthly}
```
`campaign` 文字列は `batch.ts` で生成される。`fanza.ts` で UTM を付与する。形式を変えるとアナリティクスが壊れる。

### エラーハンドリング方針
- RSS/FANZA/X/Deploy の各ステップは独立してフォールバックする
- AI選定失敗時は `buildFallbackItems()` でルールベースに切り替え（サイレント継続）
- Deploy Hook / X投稿失敗は `Promise.allSettled` で捕捉し、すべて失敗した場合のみエラースロー
- `data/latest.json` が存在しない場合、トップページは「準備中」表示（クラッシュしない）

---

## データスキーマ（型の正解は `scripts/types.ts`）

```ts
DailyData {
  date: string;          // "YYYY-MM-DD"
  items: DailyItem[];    // 5件固定
}

DailyItem {
  id: number;            // 1-5
  newsTitle: string;     // 元のニュースタイトルをそのまま使う
  genre: string;         // genreKeyword（FANZA検索キーワード）
  reason: string;        // AI生成の理由文（1〜2文、笑えるトーン）
  shareText: string;     // X用ティザー文（作品名・ジャンル名を含めない）
  product: FanzaProduct;
}

FanzaProduct {
  title: string;
  thumbnailUrl: string;  // *.dmm.co.jp か /fallback-thumb.png のみ
  affiliateUrlSingle: string;   // UTM付き
  affiliateUrlMonthly: string;  // UTM付き（高単価、こちらを優先表示）
}
```

---

## AIプロンプト設計（`scripts/ai.ts`）

現行のシステムプロンプト要件:
- ニュースタイトルは**元の文言をそのまま**使う（hallucination 防止のため `knownTitles` で検証済み）
- `genreKeyword` は FANZA 検索向け日本語1〜2語
- `reason` は1〜2文、笑えるトーン
- `shareText` は作品名・ジャンル名を含めない（ティザー戦略の核心）
- レスポンスは JSON のみ（説明文禁止）

プロンプトを変更する際は**ティザー戦略を壊さないこと**が最重要。CVR改善のためにプロンプトをチューニングする際は、`shareText` に答えが含まれていないかを必ず確認する。

---

## 環境変数

| 変数 | 用途 | 必須 |
|------|------|------|
| `ANTHROPIC_API_KEY` | Claude Haiku 選定 | バッチ必須 |
| `FANZA_API_ID` | FANZA API 認証 | バッチ必須（未設定時はフォールバック） |
| `FANZA_AFFILIATE_ID` | FANZA アフィリエイトID | バッチ必須 |
| `FANZA_MONTHLY_AFFILIATE_URL` | 月額CTA のベースURL | バッチ推奨 |
| `TWITTER_API_KEY` | X API OAuth 1.0a | X投稿必須 |
| `TWITTER_API_SECRET` | 同上 | X投稿必須 |
| `TWITTER_ACCESS_TOKEN` | 同上 | X投稿必須 |
| `TWITTER_ACCESS_TOKEN_SECRET` | 同上 | X投稿必須 |
| `VERCEL_DEPLOY_HOOK_URL` | デプロイトリガー | 本番必須 |
| `NEXT_PUBLIC_SITE_URL` | OGP・シェアURLのベース | 本番必須 |
| `NEXT_PUBLIC_TWITTER_HANDLE` | HeaderのXフォローボタン | Vercelのみ（Actions不要） |

---

## GitHub Actions（`.github/workflows/daily.yml`）

- **権限: `contents: read`のみ**（git push しないため write は不要）
- スケジュール: `0 22 * * *`（UTC）= JST 07:00
- 手動実行: `workflow_dispatch` で即時実行可能
- 失敗時: GitHub標準のメール通知

---

## セキュリティルール

1. `.env` や認証情報を git に追加しない
2. `FANZA_API_ID` / `FANZA_AFFILIATE_ID` はログに出力しない
3. OGP Route の `thumbnailUrl` は `isSafeThumbnailUrl()` でホワイトリスト検証済み（SSRF対策）
4. 外部APIレスポンスをそのまま HTML に出力しない（必ず型で受けてフィールドを選択する）

---

## テスト方針

- テストファイル: `tests/`
- フレームワーク: Vitest + jsdom + React Testing Library
- 外部 HTTP は `vi.stubGlobal("fetch", ...)` でモック
- フォールバック系テストは `console.warn` が出るが想定内
- コンポーネントテストはレンダリング + インタラクション確認

---

## 既知のトレードオフ・Gotcha

| 項目 | 状況 |
|------|------|
| `@vitejs/plugin-react` が vitest.config.ts に未追加 | v5がESM-only、CJSプロジェクトでは読み込めない。対応には `"type":"module"` 追加か `.mts` 化が必要 |
| バッチの冪等性 | 同日2回実行すると API が重複呼び出しされる。`data/${date}.json` 存在チェックで解決可能（未実装） |
| AI フォールバック | API失敗時にルールベースで5件生成して継続する。APIキー失効に気づくのが遅れる可能性あり |
| `vercel.json` | main への git push での自動デプロイを無効化済み。Deploy Hook のみでデプロイする |

---

## 収益最大化ロードマップ

| フェーズ | 施策 |
|---------|------|
| MVP（現在） | 単品CTA + 月額CTA + X自動投稿 |
| Phase 2 | UTM計測の週次集計 → どのジャンル組み合わせのCVRが高いかJSON蓄積 |
| Phase 3 | CVRデータを AI 選定プロンプトにフィードバック（自動最適化ループ） |
| Phase 4 | ユーザー入力機能（任意のニュースURLを変換） |
