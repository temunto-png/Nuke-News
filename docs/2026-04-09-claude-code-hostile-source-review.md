# 2026-04-09 Nuke News Hostile Source Review

対象リポジトリ:
- `C:\tool\claude\Nuke News`

レビュー方針:
- 実装を信用しない
- テスト通過を品質保証とみなさない
- 本番事故、収益毀損、運用事故、ブランド毀損を優先して見る

実施した確認:
- `npm test`
- `npm run build`
- 主要な `src/app/*`, `scripts/*`, `.github/workflows/daily.yml`, `tests/*` を読解

結論:
- テストとビルドは通るが、現在のコードは「壊れていても通る」状態に寄っている。
- 特に危険なのは、同日再実行時の publish 重複、文字化けの本番混入、5件保証の欠如、tweet API の情報露出。
- 今のまま機能追加へ進むより、まず運用事故を止めるための Phase 0 を切るべき。

---

## Findings

### 1. [P0] 同日再実行で deploy / tweet が重複実行される。`status.json` の設計が死んでいる

`persistDailyData()` は `persisted` を見て保存だけを skip するが、`runBatch()` はその後に必ず `publishDailyData()` を呼ぶ。つまり同じ日付で再実行すると、`date.json` は書かなくても deploy と tweet は再発火する。

しかも `DateStatus` には `deployed` と `tweeted` があるのに、publish 成功後に一度も更新していない。状態を持っているように見せて、実際には idempotency を担保していない最悪の形。

根拠:
- [scripts/batch.ts](C:\tool\claude\Nuke News\scripts\batch.ts#L27) `DateStatus` に `deployed` / `tweeted` がある
- [scripts/batch.ts](C:\tool\claude\Nuke News\scripts\batch.ts#L117) `persisted` だけを見て保存処理を skip
- [scripts/batch.ts](C:\tool\claude\Nuke News\scripts\batch.ts#L147) `publishDailyData()` は状態更新なし
- [scripts/batch.ts](C:\tool\claude\Nuke News\scripts\batch.ts#L179) `runBatch()` は保存結果に関係なく publish を呼ぶ
- [.github/workflows/daily.yml](C:\tool\claude\Nuke News\.github\workflows\daily.yml#L26) GitHub Actions 側では batch 実行時に publish を止めているが、これはローカル再実行事故を防がない

想定事故:
- 手動リトライで同じ日の投稿を重複 tweet
- 失敗復旧時に deploy だけ何度も飛ぶ
- deploy 失敗 / tweet 成功の片肺状態で再実行すると tweet だけ二重になる

Claude Code への指示:
- `publishDailyData()` を `deploy` / `tweet` 単位で状態管理する
- `runBatch()` は「生成」「保存」「公開」を明示的に分離し、各段階を idempotent にする
- `persisted` 済み日付の再実行時は、明示オプションなしで side effect を再発火させない

### 2. [P1] 文字化けが本番文字列に混入している。SEO・OGP・X投稿・ジャンルページが壊れている

これは見た目の問題ではない。メタデータ、OGP 文言、tweet 文言、ジャンルページ文言、テスト fixture まで壊れている。つまり「壊れた日本語を正として開発している」状態。

根拠:
- [src/app/layout.tsx](C:\tool\claude\Nuke News\src\app\layout.tsx#L6) `metadata.title` / `description` が文字化け
- [src/app/api/og/route.tsx](C:\tool\claude\Nuke News\src\app\api\og\route.tsx#L79) OGP fallback 文言が文字化け
- [src/app/api/og/route.tsx](C:\tool\claude\Nuke News\src\app\api\og\route.tsx#L92) 補助文言も文字化け
- [src/app/genre/[genre]/page.tsx](C:\tool\claude\Nuke News\src\app\genre\[genre]\page.tsx#L19) genre metadata が文字化け
- [src/app/genre/[genre]/page.tsx](C:\tool\claude\Nuke News\src\app\genre\[genre]\page.tsx#L43) genre page UI 文言が文字化け
- [scripts/tweet-api.ts](C:\tool\claude\Nuke News\scripts\tweet-api.ts#L7) tweet 本文テンプレートが文字化け
- [tests/tweet-api.test.ts](C:\tool\claude\Nuke News\tests\tweet-api.test.ts#L5) テスト側も文字化け fixture で固定化

まずい理由:
- SNS card / OGP / title / description が壊れる
- X 投稿文が壊れる
- テストが品質を守るどころか破損を温存する

Claude Code への指示:
- 文字コード事故を Phase 0 扱いで最優先修正
- 壊れた fixture を日本語正規文に置換
- 文字列を 1 か所ずつ直すのでなく、「どのファイルが壊れているか」を先に棚卸しして一括で正す

### 3. [P1] 「5本サイト」と言いながら、5件未満でもそのまま公開できる

UI もコピーもヘッダーも「今日の5本」を前提にしているが、生成パイプラインは 5 件を保証していない。RSS が部分的に死んでも `successCount > 0` なら続行するし、AI fallback も入力記事数が足りなければそのまま少ない件数で終わる。

根拠:
- [scripts/rss.ts](C:\tool\claude\Nuke News\scripts\rss.ts#L49) 全ソース失敗時しか落とさない
- [scripts/rss.ts](C:\tool\claude\Nuke News\scripts\rss.ts#L55) 記事数の下限チェックがない
- [scripts/ai.ts](C:\tool\claude\Nuke News\scripts\ai.ts#L47) fallback は `slice(0, TARGET_ITEMS)` だが元記事が少なければ不足する
- [scripts/ai.ts](C:\tool\claude\Nuke News\scripts\ai.ts#L161) 5件未満でもそのまま返せる
- [src/app/components/Header.tsx](C:\tool\claude\Nuke News\src\app\components\Header.tsx#L24) UI は常に `の5本`

想定事故:
- RSS 側の一時障害で 2〜3件しかない「今日の5本」が公開される
- CTA 面積が減って収益落ちする
- 5件前提の運用説明と実態が乖離する

Claude Code への指示:
- publish 前に `items.length === 5` を hard requirement にする
- 足りない場合は publish 失敗にするか、明示的な代替ロジックで 5 件埋める
- 5件保証をテストで固定する

### 4. [P1] `/api/tweet` が失敗時に投稿本文サンプルと upstream 詳細をそのまま返す

この API は bearer secret を知っていれば叩ける。失敗時には upstream error の詳細、`textLen`、`textSample` まで JSON で返している。しかも通常時も冒頭 120 文字をサーバーログへ出している。

秘密そのものは出していないが、「投稿内容」と「upstream の詳細」を余計に露出しており、防御的設計として雑すぎる。

根拠:
- [src/app/api/tweet/route.ts](C:\tool\claude\Nuke News\src\app\api\tweet\route.ts#L25) 投稿本文 preview をログ出力
- [src/app/api/tweet/route.ts](C:\tool\claude\Nuke News\src\app\api\tweet\route.ts#L59) `detail`, `data`, `errors`, `textSample`, `upstreamStatus` をそのまま返却

まずい理由:
- 不要な情報露出
- 将来 tweet 本文に運用メモや一時デバッグ情報が乗ったときに漏れる
- 失敗レスポンスの安定性が upstream 依存になる

Claude Code への指示:
- API 返却は固定エラーコードと短いメッセージに絞る
- サーバーログも本文そのものは出さず、長さと request id 程度にする
- 詳細はサーバー内部ログに閉じる

### 5. [P2] 日付フォールバックが UTC 依存で、日本時間の朝にズレる

サイト全体は JST 前提なのに、ホームの metadata と header の fallback 日付が `new Date().toISOString().slice(0, 10)` になっている。`latest.json` がない、または読めない時、日本時間の 00:00-08:59 では前日表示になる。

根拠:
- [src/app/page.tsx](C:\tool\claude\Nuke News\src\app\page.tsx#L10) metadata 用 fallback 日付が UTC
- [src/app/page.tsx](C:\tool\claude\Nuke News\src\app\page.tsx#L30) Header 用 fallback 日付も UTC
- [scripts/batch.ts](C:\tool\claude\Nuke News\scripts\batch.ts#L10) バッチ側は JST で日付を決めており、アプリ側と整合していない
- [scripts/wait-for-publication.ts](C:\tool\claude\Nuke News\scripts\wait-for-publication.ts#L4) 公開確認側も JST ロジックを別実装している

影響:
- 早朝に `latest.json` が欠けた時、OGP とヘッダーの日付が前日に見える
- デバッグ時に「どの日付を正としているか」が層ごとにズレる

Claude Code への指示:
- JST 日付ユーティリティを 1 箇所へ寄せてフロント / スクリプトで共通化
- `latest.json` 不在時の挙動を仕様化する

---

## Secondary Risks

- [src/app/lib/data.ts](C:\tool\claude\Nuke News\src\app\lib\data.ts#L7) request path で同期 FS 読み込みを多用しており、今後データ量が増えると build / request の足を引っ張る
- [scripts/seed.ts](C:\tool\claude\Nuke News\scripts\seed.ts#L26) seed のログにも文字化けが混入しており、運用観測性まで壊し始めている
- [tests/tweet-api.test.ts](C:\tool\claude\Nuke News\tests\tweet-api.test.ts#L23) テストが「壊れた文字列でも 280 文字以内なら OK」を保証してしまっている

---

## 推奨順序

1. Phase 0: 文字化け修正と fixture 正常化
2. Phase 1: `runBatch` / `publishDailyData` の idempotency 修正
3. Phase 2: 5件保証の導入
4. Phase 3: tweet API の情報露出削減
5. Phase 4: JST 日付ロジックの共通化

---

## Claude Code への短い引き継ぎ

いま最初に触るべきなのは見た目ではなく運用事故の火種です。`scripts/batch.ts` の publish idempotency を直さない限り、手動再実行や部分復旧で duplicate tweet / duplicate deploy を踏みます。その次に、文字化けをまとめて直してください。現在はテストまで壊れた日本語を正解として固定しています。

`npm test` と `npm run build` は通っています。ただし、このレビューの主眼は「通るのに壊れている箇所」です。テスト通過をもって安心しないでください。
