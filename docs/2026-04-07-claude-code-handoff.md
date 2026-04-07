# Claude Code Handoff

最終更新: 2026-04-07

## 概要

- リポジトリ: `https://github.com/temunto-png/Nuke-News.git`
- 最新 push 済みコミット: `8a4cd7180f0dfdac8b995bee70a715473289bbed`
- ローカル状態: コードレビュー修正を適用済み（未コミット）
- 実装ベース: Next.js 15 + TypeScript + Tailwind + Vitest

## 今回完了したこと

- Next.js App Router のサイト本体を新規実装
- 日次バッチの基盤を実装
  - RSS 取得
  - Anthropic での選定
  - FANZA 作品取得
  - Deploy Hook 呼び出し
  - X 投稿
- OGP 画像 API、`sitemap.xml`、`robots.txt` を実装
- GitHub Actions の日次実行 workflow を追加
- テストを追加し、`npm test` と `npm run build` を通過済み
- 敵対的レビュー後に以下をブラッシュアップ済み
  - 日本語文字化けの解消
  - AI 出力の検証とフォールバック
  - FANZA API 障害時のフォールバック
  - RSS 取得の timeout と重複除去
  - `latest.json` 欠損時のトップページ退避
- **コードレビュー（世界最高エンジニア目線）を実施し、Critical/Important を修正済み**
  - C-2: `.github/workflows/daily.yml` の `contents: write` → `contents: read`
  - C-3: `scripts/deploy.ts` に `AbortSignal.timeout(10000)` を追加
  - C-1: `src/app/api/og/route.tsx` に `thumbnailUrl` ホワイトリスト検証（`*.dmm.co.jp` / `*.dmm.com` のみ許可）
  - I-1: `scripts/rss.ts` / `scripts/fanza.ts` の `createTimeoutSignal()` を `AbortSignal.timeout()` に統一（タイマーリーク解消）
  - I-3: `src/app/components/NewsCard.tsx` の `<img>` → `next/image` の `<Image fill>` に移行

## 主なファイル

- サイト本体: [src/app/page.tsx](/C:/tool/claude/Nuke%20News/src/app/page.tsx)
- 日付別ページ: [src/app/[date]/page.tsx](/C:/tool/claude/Nuke%20News/src/app/%5Bdate%5D/page.tsx)
- カード UI: [src/app/components/NewsCard.tsx](/C:/tool/claude/Nuke%20News/src/app/components/NewsCard.tsx)
- データ読み込み: [src/app/lib/data.ts](/C:/tool/claude/Nuke%20News/src/app/lib/data.ts)
- AI 選定: [scripts/ai.ts](/C:/tool/claude/Nuke%20News/scripts/ai.ts)
- RSS 取得: [scripts/rss.ts](/C:/tool/claude/Nuke%20News/scripts/rss.ts)
- FANZA 取得: [scripts/fanza.ts](/C:/tool/claude/Nuke%20News/scripts/fanza.ts)
- バッチ本体: [scripts/batch.ts](/C:/tool/claude/Nuke%20News/scripts/batch.ts)
- Deploy Hook: [scripts/deploy.ts](/C:/tool/claude/Nuke News/scripts/deploy.ts)
- 日次 workflow: [.github/workflows/daily.yml](/C:/tool/claude/Nuke%20News/.github/workflows/daily.yml)
- 設計書: [2026-04-07-nuke-news-design.md](/C:/tool/claude/Nuke%20News/docs/superpowers/specs/2026-04-07-nuke-news-design.md)
- 実装計画: [2026-04-07-nuke-news-implementation.md](/C:/tool/claude/Nuke%20News/docs/superpowers/plans/2026-04-07-nuke-news-implementation.md)

## 検証結果

- `npm test`: 16 tests passed（コードレビュー修正後も通過）
- `npm run build`: pass（コードレビュー修正後も通過）

補足:
- Vitest 実行時に fallback 系テストの `console.warn` は出るが、想定内
- Windows 環境では一部 `git` / `npm` 実行に権限昇格が必要だった

## 残存 Minor 指摘（対応任意）

コードレビューで指摘されたが今回対応しなかった項目：

| # | 内容 | 理由 |
|---|------|------|
| I-2 | AI フォールバック動作（エラースロー vs サイレントフォールバック）の設計方針明確化 | ビジネス要件の判断が必要 |
| I-4 | バッチの冪等性（同日2回実行時に API 重複呼び出し）| `data/${date}.json` 存在チェックを追加で解決可能 |
| I-5 | `vitest.config.ts` に `@vitejs/plugin-react` 未追加 | `@vitejs/plugin-react` v5 が ESM-only のため CJS プロジェクトでは追加不可。`"type":"module"` 追加か `.mts` 拡張子変更が必要 |
| M-3 | バッチ失敗時の Slack 通知未実装 | GitHub Actions の標準メール通知で代替中 |
| M-4 | `NEXT_PUBLIC_TWITTER_HANDLE` が Actions secrets にない | Vercel ダッシュボードで設定する変数（バッチには不要） |

## 未完了タスク

コードはほぼ実装済みだが、運用開始には以下が未完了。

1. **修正分をコミット＆プッシュ**（コードレビュー対応分がローカルに留まっている）
2. Vercel に GitHub リポジトリを import
3. 環境変数を設定
4. Deploy Hook を作成し `VERCEL_DEPLOY_HOOK_URL` を投入
5. GitHub Actions Secrets を設定
6. workflow を手動実行して本番バッチを検証
7. 必要なら X 投稿文面や AI プロンプトのトーンを微調整

## 必須環境変数

`.env.example` に定義済み。

- `ANTHROPIC_API_KEY`
- `FANZA_API_ID`
- `FANZA_AFFILIATE_ID`
- `FANZA_MONTHLY_AFFILIATE_URL`
- `TWITTER_API_KEY`
- `TWITTER_API_SECRET`
- `TWITTER_ACCESS_TOKEN`
- `TWITTER_ACCESS_TOKEN_SECRET`
- `VERCEL_DEPLOY_HOOK_URL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_TWITTER_HANDLE`（Vercel ダッシュボードのみ、Actions secrets 不要）

## Claude Code で次にやると良いこと

1. コードレビュー修正分をコミット＆プッシュ
2. Vercel 連携と Secrets 設定を完了させる
3. GitHub Actions の `workflow_dispatch` で手動実行
4. 生成される `data/YYYY-MM-DD.json` の中身をレビュー
5. 実際の FANZA 返却値に合わせて ranking ロジックを改善
6. AI プロンプトを CVR 観点で改善
7. 必要なら `README.md` を追加して運用手順を整備

## 注意点

- リポジトリには `docs/` と `Nuke News.md` も含めて push 済み
- `.claude/` は `.gitignore` に追加済みで push 対象外
- いまの `vercel.json` は `main` への Git push 自動デプロイを無効化している
- 本番デプロイは Deploy Hook 前提
- FANZA や X の認証情報が未設定だと、バッチは期待通りには動かない
- コードレビュー修正は **未コミット**。次セッション開始時にまずコミットすること

## 引き継ぎメッセージ

コードレビュー（Critical 3件・Important 2件）を適用済み。`npm test` / `npm run build` ともに通過確認済み。次フェーズは「コミット → Vercel + GitHub Secrets 接続 → 日次バッチの実運用確認」。
