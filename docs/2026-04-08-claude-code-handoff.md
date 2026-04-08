# Claude Code Handoff

最終更新: 2026-04-08 JST

## 目的

X 投稿の `403` 調査と、daily batch が本当に公開データを更新してから投稿する構成への修正内容を、Claude Code がすぐ追える形で整理する。

## 結論

- `403` の本筋は、既存メモどおり GitHub Actions 実行環境から X API を直接叩くと拒否される可能性が高い。
- それに加えて、従来構成には「Actions 上で `data/*.json` を更新しても、その生成物は Vercel 本番へ反映されないまま deploy hook だけ叩く」という構造上の欠陥があった。
- そのため、batch 実行後に `data` を commit/push し、公開ページ反映を待ってから Vercel API Route 経由で投稿するフローへ変更した。

## 今回の修正

### 1. batch の責務分離

- `C:\tool\claude\Nuke News\scripts\batch.ts`
  - JSON 生成は維持
  - `SKIP_DEPLOY_HOOK` / `SKIP_TWEET` フラグを追加
  - workflow からは JSON 生成専用として実行できるようにした

### 2. daily workflow の再設計

- `C:\tool\claude\Nuke News\.github\workflows\daily.yml`
  - `contents: write` に変更
  - `actions/checkout` で `ref: ${{ github.ref_name }}` を指定
  - `npm run batch` 実行時は `SKIP_DEPLOY_HOOK=1` と `SKIP_TWEET=1`
  - `data` に変更がある場合のみ commit/push
  - push 後に `npm run wait:publish` で公開待ち
  - 公開後に `npm run tweet` で投稿

### 3. 投稿モジュールの改善

- `C:\tool\claude\Nuke News\scripts\tweet-api.ts`
  - 旧 `scripts/twitter.ts` の代替として追加
  - `NEXT_PUBLIC_SITE_URL` の末尾スラッシュを正規化
  - 投稿文を 280 文字制約に収まるよう短縮
  - エラー時に `siteUrl/api/tweet` を含むメッセージを返す

### 4. 投稿用補助スクリプトの追加

- `C:\tool\claude\Nuke News\scripts\post-latest-tweet.ts`
  - `data/latest.json` を読んで投稿する専用スクリプト

- `C:\tool\claude\Nuke News\scripts\wait-for-publication.ts`
  - `NEXT_PUBLIC_SITE_URL/<date>` をポーリングして公開反映を待つ

### 5. Vercel API Route の可観測性向上

- `C:\tool\claude\Nuke News\src\app\api\tweet\route.ts`
  - X API エラー時に upstream status を JSON に含める
  - サーバーログに detail / errors / textLen を出す

### 6. typecheck の安定化

- `C:\tool\claude\Nuke News\package.json`
  - `typecheck` を `next typegen && tsc --noEmit` に変更

- `C:\tool\claude\Nuke News\tsconfig.json`
  - `.next/types/**/*.ts` を含む形を維持
  - `next typegen` 前提で安定実行する構成にした

### 7. テストと設定例の更新

- `C:\tool\claude\Nuke News\tests\batch.test.ts`
  - モック対象を `../scripts/tweet-api` へ変更

- `C:\tool\claude\Nuke News\tests\tweet-api.test.ts`
  - 新規追加
  - 投稿文が URL 正規化されることと、280 文字以内に収まることを確認

- `C:\tool\claude\Nuke News\.env.example`
  - `TWEET_SECRET` を追加

## 現在の未解決事項

### 1. 旧ファイルが残っている

- `C:\tool\claude\Nuke News\scripts\twitter.ts`
  - 旧実装が残っている
  - 現在は `scripts/batch.ts` から参照していない
  - 将来的には削除して一本化したい

### 2. テストはこの環境で未実行

- `npm test` はこの sandbox では `spawn EPERM` で失敗した
- 実コード不正ではなく、この実行環境の制約によるもの

### 3. 本番設定確認が必要

以下が Vercel / GitHub Secrets に揃っているか要確認:

- `TWITTER_API_KEY`
- `TWITTER_API_SECRET`
- `TWITTER_ACCESS_TOKEN`
- `TWITTER_ACCESS_TOKEN_SECRET`
- `TWEET_SECRET`
- `NEXT_PUBLIC_SITE_URL`
- `ANTHROPIC_API_KEY`
- `FANZA_API_ID`
- `FANZA_AFFILIATE_ID`
- `FANZA_MONTHLY_AFFILIATE_URL`

## 動作確認結果

- 成功:
  - `npm run typecheck`
  - `npm run build`

- この環境では未成功:
  - `npm test`
    - 失敗理由: `spawn EPERM`

## 次に見るべきファイル

- `C:\tool\claude\Nuke News\.github\workflows\daily.yml`
- `C:\tool\claude\Nuke News\scripts\batch.ts`
- `C:\tool\claude\Nuke News\scripts\tweet-api.ts`
- `C:\tool\claude\Nuke News\scripts\post-latest-tweet.ts`
- `C:\tool\claude\Nuke News\scripts\wait-for-publication.ts`
- `C:\tool\claude\Nuke News\src\app\api\tweet\route.ts`
- `C:\tool\claude\Nuke News\tests\tweet-api.test.ts`
- `C:\tool\claude\Nuke News\.env.example`

## 推奨する次アクション

1. GitHub Actions の `workflow_dispatch` で `Daily Batch` を手動実行する。
2. `data/latest.json` が commit/push されることを確認する。
3. Vercel 側で対象日ページが公開されることを確認する。
4. `/api/tweet` 経由で投稿成功、または upstream status 付きエラーが返ることを確認する。
5. 問題なければ `C:\tool\claude\Nuke News\scripts\twitter.ts` を削除して参照を一本化する。
