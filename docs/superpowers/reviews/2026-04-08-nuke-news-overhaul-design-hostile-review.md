# 2026-04-08 Nuke News Overhaul Design Hostile Review

対象設計書:
- `C:\tool\claude\Nuke News\docs\superpowers\specs\2026-04-08-nuke-news-overhaul-design.md`

目的:
- Claude Code がこの設計書をそのまま実装して事故らないように、アーキテクト視点で危険箇所を先に明示する
- 優先順位付きで「直すべき設計ミス」と「後回しでよい論点」を切り分ける

---

## 総評

方向性自体は理解できるが、現行実装の責務分離と障害復旧を軽視している。

この設計の危険な点は、見た目の改善や審査向け体裁の整備に意識が寄りすぎており、実運用で事故る箇所を温存したまま Phase を積み上げようとしていること。

特にまずいのは以下:

- `runBatch` が「生成」「公開」「告知」を同時に担っているのに、そのまま `seed.ts` から再利用しようとしている
- 冪等性の定義が雑で、部分失敗からの復旧シナリオが欠落している
- Phase 4 の成長施策が、Phase 0 のアーキテクチャ制約と衝突している
- すでに表面化している文字化け障害をスコープ外にしている

---

## Findings

### 1. [P0] `seed.ts` 設計のままでは過去日付の補完時に deploy と tweet を大量誤発火する

設計書は `scripts/seed.ts` から `runBatch(date)` を順次呼ぶ前提になっている。しかし現行の `runBatch` は JSON 生成専用関数ではなく、以下を同時に実行する:

- データ生成
- `latest.json` 更新
- deploy hook 実行
- X 投稿実行

そのため、過去14日を埋める seed を走らせると、履歴補完のつもりが deploy と tweet を最大14回走らせる事故になる。

参照:
- `C:\tool\claude\Nuke News\docs\superpowers\specs\2026-04-08-nuke-news-overhaul-design.md` lines 45-49
- `C:\tool\claude\Nuke News\scripts\batch.ts` lines 29-81

Claude Code への指示:
- `runBatch` をそのまま seed から使い回さない
- 最低でも「generateDailyData」「persistDailyData」「publishDailyData」の3責務に分離してから seed を設計する
- backfill 時は deploy/tweet/latest 更新を抑止できる explicit option を持たせる

### 2. [P0] 提案されている冪等化は部分失敗を永久化する

設計書は `date.json` が存在したら即 return する案を冪等性として提示しているが、これは冪等ではなく「再実行不能化」に近い。

現行フローでは:

1. `date.json` を書く
2. `latest.json` を書く
3. deploy/tweet を走らせる

つまり、以下の中途半端な失敗が起こりうる:

- `date.json` だけ存在し、`latest.json` は古い
- JSON は書けたが tweet だけ落ちた
- JSON は書けたが deploy だけ落ちた

この状態で `date.json` の存在だけ見て skip すると、永遠に修復できない。

参照:
- `C:\tool\claude\Nuke News\docs\superpowers\specs\2026-04-08-nuke-news-overhaul-design.md` lines 104-114
- `C:\tool\claude\Nuke News\scripts\batch.ts` lines 49-79

Claude Code への指示:
- 冪等性は「ファイルがあるか」ではなく「その date の処理状態が完了しているか」で判定する
- 少なくとも以下を分離する
- データ生成の冪等性
- latest 更新の冪等性
- tweet/deploy の冪等性
- 可能なら manifest か status file を導入する

### 3. [P1] Phase 4 のジャンル別アーカイブは、現行アーキテクチャのままだと成長するほど遅くなる

設計書は `DBなし・git管理JSON` を維持すると明言しつつ、`listDatesByGenre` で `data/*.json` を全走査する方針を置いている。

現行 `src/app/lib/data.ts` も同期 FS 読み込み前提なので、データが増えるほど:

- build 時間が伸びる
- sitemap 生成コストが増える
- genre archive の SSG/SSR コストが増える
- ローカル開発体験も悪化する

これは「成長加速」の Phase で自分から足かせをつける設計になっている。

参照:
- `C:\tool\claude\Nuke News\docs\superpowers\specs\2026-04-08-nuke-news-overhaul-design.md` lines 33-35
- `C:\tool\claude\Nuke News\docs\superpowers\specs\2026-04-08-nuke-news-overhaul-design.md` lines 197-208
- `C:\tool\claude\Nuke News\src\app\lib\data.ts` lines 29-50

Claude Code への指示:
- 全 JSON スキャンを request path に載せない
- batch 時に `genre-index.json` のような索引を事前生成する
- sitemap も index ベースで生成する
- 「DBを入れない」制約は維持してもよいが、「索引を持たない」制約までは背負わない

### 4. [P1] 「5件すべて異なる genreKeyword」は収益最適化の成功条件として不適切

設計書は Phase 3 の成功指標として「ジャンルが5件全て異なること」を置いている。しかし現行収益導線では `genreKeyword` をそのまま FANZA API 検索に使っているため、見た目の多様性と商品ヒット率はトレードオフになる。

強いキーワードが複数回選ばれること自体は悪ではない。むしろ CVR を考えるなら、

- 商品ヒット率
- 実商品率
- fallback 流入率
- CTA CTR

を最適化すべきで、キーワードの重複禁止は目的と手段が逆転している。

参照:
- `C:\tool\claude\Nuke News\docs\superpowers\specs\2026-04-08-nuke-news-overhaul-design.md` lines 122-135
- `C:\tool\claude\Nuke News\docs\superpowers\specs\2026-04-08-nuke-news-overhaul-design.md` line 241
- `C:\tool\claude\Nuke News\scripts\ai.ts` lines 46-60
- `C:\tool\claude\Nuke News\scripts\fanza.ts` lines 65-124

Claude Code への指示:
- 「全件異なるジャンル」を hard requirement にしない
- 代わりに「同一ジャンル偏重を避ける soft constraint」にする
- 実測指標として `productHitRate` と `fallbackRate` を追加する

### 5. [P1] fallback 判定を `thumbnailUrl` に依存させる設計はデータモデルとして破綻している

設計書は `thumbnailUrl === "/fallback-thumb.png"` のとき CTA 文言を切り替える前提だが、現行実装では「実在商品だが画像URLだけ不正」でも fallback thumbnail になる。

つまり:

- 商品リンクは本物
- しかしサムネだけ fallback

というケースで、CTA 文言だけ「今日の作品を探す →」のような fallback 用メッセージに化ける。

これは UI 層がデータの真実を勝手に推測している状態。

参照:
- `C:\tool\claude\Nuke News\docs\superpowers\specs\2026-04-08-nuke-news-overhaul-design.md` line 102
- `C:\tool\claude\Nuke News\scripts\fanza.ts` lines 117-123
- `C:\tool\claude\Nuke News\src\app\components\NewsCard.tsx` lines 18-54

Claude Code への指示:
- `isFallbackProduct` のような明示フラグを `FanzaProduct` に追加する
- CTA 文言分岐はそのフラグに基づいて行う
- 表示画像の fallback と、商品解決の fallback を混同しない

### 6. [P1] 文字化け障害を放置したまま審査・SEO・SNS改善を語っている

現行コードには文字化けが残っている。

確認できた箇所:

- `src/app/layout.tsx` metadata
- `src/app/api/og/route.tsx` のフォールバック文言
- `scripts/twitter.ts` の投稿文面

これは審査、SNS、OGP、SEO の全接点を直接傷つける本番障害であり、CTA テキスト改善より先に潰すべき。

参照:
- `C:\tool\claude\Nuke News\src\app\layout.tsx` lines 5-6
- `C:\tool\claude\Nuke News\src\app\api\og\route.tsx` lines 58-61
- `C:\tool\claude\Nuke News\scripts\twitter.ts` lines 4-12

Claude Code への指示:
- 文字化け修正を Phase 0 として切り出す
- レビュー上の優先度は About/Privacy 新設より上
- 文字コード問題の原因がファイル保存時か terminal 表示だけかを切り分けてから直す

### 7. [P2] 成功指標が結果偏重で、日々の改善判断に使えない

設計書の成功指標は以下のように抽象的すぎる:

- DMMアフィリエイト審査通過
- CTAクリックでDMMに遷移
- ジャンルが5件全て異なる
- X投稿にニュースタイトルが含まれない

これでは改善の当たり外れを定量判断できない。

必要なのは先行指標:

- FANZA API 成功率
- 実商品ヒット率
- fallback rate
- CTA CTR
- tweet to site CTR
- data build duration
- sitemap generation duration

参照:
- `C:\tool\claude\Nuke News\docs\superpowers\specs\2026-04-08-nuke-news-overhaul-design.md` lines 235-242

Claude Code への指示:
- Phase ごとに観測可能な leading KPI を定義する
- 「審査通過」は最終成果であって、設計の良し悪しを日次で判定するメトリクスではない

---

## 見落としている重要論点

### 1. `latest.json` の扱いが曖昧

設計書は日付データの補完に集中しているが、現行トップページは `latest.json` を優先して読む。

つまり seed/backfill で過去日付を生成するときに `latest.json` をどう扱うかを明文化しないと、トップページの表示日付が意図せず巻き戻る可能性がある。

Claude Code への指示:
- `persistDailyData(date, { updateLatest: boolean })` のように制御可能にする
- backfill では原則 `latest.json` を更新しない

### 2. Phase の分け方が実装単位で、障害境界に沿っていない

今の Phase 分割は:

- 審査通過
- 収益起動
- CVR最大化
- 成長加速

だが、コード上の事故境界は:

- データ生成
- データ保存
- 公開副作用
- 表示/UI
- 探索/SEO

にある。ビジネス用語で切ると、壊れ方の責任範囲が不明瞭になる。

Claude Code への指示:
- 実装計画は責務境界に沿って切り直す
- ビジネス Phase はロードマップとして残してよいが、実装タスク分解には使わない

---

## 改訂方針

Claude Code で実装するなら、以下の順に設計を組み替えるべき。

1. Phase 0: 文字化け修正
2. Phase 1: `runBatch` の責務分離
3. Phase 2: backfill/seed 専用経路の追加
4. Phase 3: fallback 状態のデータモデル化
5. Phase 4: About/Privacy/Footer 追加
6. Phase 5: CTA/OGP/metadata の改善
7. Phase 6: genre index の事前生成を前提に archive/sitemap を追加

---

## Claude Code 実装時のガードレール

- `runBatch` を seed から直接呼ばない
- `date.json exists => skip` を冪等性と呼ばない
- request 時に `data/*.json` 全走査しない
- UI で fallback を推測しない
- success metric を見た目ではなく運用指標で定義する
- 文字化けを後回しにしない

---

## ひとことで言うと

この設計書の一番の問題は、プロダクト改善の話をしているようで、実際には運用事故の導火線を増やしていること。

Claude Code では、まず責務分離と障害復旧可能性を作ってから、その上に審査対策・CVR 改善・SEO を積むべき。
