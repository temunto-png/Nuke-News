# Nuke News 全面改修 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DMMアフィリエイト審査通過・収益起動・CVR最大化・成長加速のための全面改修を Phase 0〜6 で完成させる。

**Architecture:** 既存の batch→JSON→SSG→Vercel アーキテクチャを維持しつつ、`runBatch` の責務を `generateDailyData / persistDailyData / publishDailyData` に分離し、seed スクリプトが deploy/tweet を誤発火しない設計に変更する。`data/status.json` で冪等性を管理し、`data/genre-index.json` をバッチ時に生成して build/request 時の全走査を排除する。

**Tech Stack:** Next.js 15 App Router (SSG), TypeScript, Tailwind CSS v3, Vitest, `@anthropic-ai/sdk` (Claude Haiku tool_use), FANZA Affiliate API v3, Vercel (OG/Analytics), X API v2 (OAuth 1.0a)

**ベースブランチ:** `main`  
**設計書:** `docs/superpowers/specs/2026-04-08-nuke-news-overhaul-design.md`

---

## ファイルマップ

| Phase | 操作 | ファイル |
|-------|------|---------|
| 0 | 削除 | `scripts/twitter.ts` |
| 1 | 変更 | `scripts/batch.ts`, `tests/batch.test.ts` |
| 2 | 新規 | `scripts/seed.ts`, `data/status.json` |
| 2 | 変更 | `scripts/batch.ts`, `tests/batch.test.ts` |
| 3 | 変更 | `scripts/types.ts` |
| 3 | 変更 | `scripts/fanza.ts`, `tests/fanza.test.ts` |
| 3 | 変更 | `src/app/components/NewsCard.tsx`, `tests/tweet-api.test.ts`, `tests/batch.test.ts` |
| 4 | 新規 | `src/app/about/page.tsx`, `src/app/privacy/page.tsx`, `src/app/components/Footer.tsx` |
| 4 | 変更 | `src/app/layout.tsx` |
| 5 | 変更 | `scripts/ai.ts`, `tests/ai.test.ts` |
| 5 | 変更 | `src/app/api/og/route.tsx` |
| 5 | 変更 | `src/app/page.tsx` |
| 5 | 変更 | `src/app/components/NewsCard.tsx` |
| 6 | 変更 | `scripts/batch.ts`, `tests/batch.test.ts` |
| 6 | 変更 | `src/app/lib/data.ts` |
| 6 | 新規 | `src/app/genre/[genre]/page.tsx`, `src/app/sitemap.ts` |
| 6 | 新規 | `data/genre-index.json` (seed 実行時に自動生成) |

---

## Task 1: Phase 0 — 旧 twitter.ts 削除・エンコーディング確認

**Files:**
- Delete: `scripts/twitter.ts`

旧実装 `scripts/twitter.ts` はニュースタイトルをツイートに列挙するティザー戦略違反コードを含み、`batch.ts` から未参照。削除してビルドが通ることを確認する。

- [ ] **Step 1: twitter.ts の未参照を確認**

```bash
grep -r "from.*twitter" scripts/ src/ --include="*.ts" --include="*.tsx"
```

`scripts/twitter.ts` への import が存在しないことを確認する（結果が空 or `tweet-api.ts` のみ）。

- [ ] **Step 2: scripts/twitter.ts を削除**

```bash
rm scripts/twitter.ts
```

- [ ] **Step 3: ビルド・型チェック・テスト通過確認**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Expected: すべて PASS。

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "chore: delete obsolete scripts/twitter.ts (superseded by tweet-api.ts)"
```

---

## Task 2: Phase 1 — runBatch 責務分離

**Files:**
- Modify: `scripts/batch.ts`
- Modify: `tests/batch.test.ts`

`runBatch` が持つ「生成・保存・発火」を3つの独立した関数に分離する。`seed.ts`（Phase 2）が `publishDailyData` を呼ばずに安全に使えるようにする。

- [ ] **Step 1: batch.test.ts を新しい3関数仕様で書き直す**

`tests/batch.test.ts` を以下で完全置換する:

```typescript
import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/rss", () => ({
  fetchArticles: vi.fn().mockResolvedValue([
    { title: "ニュース", description: "概要", link: "https://example.com" },
  ]),
}));

vi.mock("../scripts/ai", () => ({
  selectAndGenerateItems: vi.fn().mockResolvedValue([
    { newsTitle: "ニュース", genreKeyword: "熟女", reason: "理由", shareText: "シェア文" },
  ]),
}));

vi.mock("../scripts/fanza", () => ({
  fetchFanzaProduct: vi.fn().mockResolvedValue({
    title: "作品",
    thumbnailUrl: "https://example.com/thumb.jpg",
    affiliateUrlSingle: "https://example.com/single",
    affiliateUrlMonthly: "https://example.com/monthly",
    isFallback: false,
  }),
}));

vi.mock("../scripts/deploy", () => ({
  triggerDeploy: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../scripts/tweet-api", () => ({
  postDailyTweet: vi.fn().mockResolvedValue(undefined),
}));

const tempRoot = path.join(process.cwd(), ".tmp-batch-test");
const originalCwd = process.cwd();

beforeEach(async () => {
  await fs.mkdir(tempRoot, { recursive: true });
  process.chdir(tempRoot);
  vi.resetModules();
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe("generateDailyData", () => {
  it("DailyData を返す（ファイル書き込みなし）", async () => {
    const { generateDailyData } = await import("../scripts/batch");
    const result = await generateDailyData("2026-04-07");

    expect(result.date).toBe("2026-04-07");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].newsTitle).toBe("ニュース");

    // ファイルが書かれていないことを確認
    const exists = await fs.access(path.join(tempRoot, "data", "2026-04-07.json")).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });
});

describe("persistDailyData", () => {
  it("date.json と latest.json を書き出す (updateLatest: true)", async () => {
    const { generateDailyData, persistDailyData } = await import("../scripts/batch");
    const data = await generateDailyData("2026-04-07");
    await persistDailyData("2026-04-07", data, { updateLatest: true });

    const daily = JSON.parse(
      await fs.readFile(path.join(tempRoot, "data", "2026-04-07.json"), "utf8"),
    ) as { date: string };
    const latest = JSON.parse(
      await fs.readFile(path.join(tempRoot, "data", "latest.json"), "utf8"),
    ) as { date: string };

    expect(daily.date).toBe("2026-04-07");
    expect(latest.date).toBe("2026-04-07");
  });

  it("latest.json を更新しない (updateLatest: false)", async () => {
    const { generateDailyData, persistDailyData } = await import("../scripts/batch");
    const data = await generateDailyData("2026-04-07");
    await persistDailyData("2026-04-07", data, { updateLatest: false });

    const daily = JSON.parse(
      await fs.readFile(path.join(tempRoot, "data", "2026-04-07.json"), "utf8"),
    ) as { date: string };
    const latestExists = await fs.access(path.join(tempRoot, "data", "latest.json")).then(() => true).catch(() => false);

    expect(daily.date).toBe("2026-04-07");
    expect(latestExists).toBe(false);
  });
});

describe("runBatch", () => {
  it("generate + persist + publish を順に実行して DailyData を返す", async () => {
    const { runBatch } = await import("../scripts/batch");
    const result = await runBatch("2026-04-07");

    expect(result.date).toBe("2026-04-07");

    const latest = JSON.parse(
      await fs.readFile(path.join(tempRoot, "data", "latest.json"), "utf8"),
    ) as { date: string };
    expect(latest.date).toBe("2026-04-07");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npm test -- tests/batch.test.ts
```

Expected: `generateDailyData is not a function` / `persistDailyData is not a function` 等で FAIL。

- [ ] **Step 3: scripts/batch.ts を3関数構成に書き直す**

`scripts/batch.ts` を以下で完全置換する:

```typescript
import fs from "node:fs/promises";
import path from "node:path";
import { selectAndGenerateItems } from "./ai";
import { triggerDeploy } from "./deploy";
import { fetchFanzaProduct } from "./fanza";
import { fetchArticles } from "./rss";
import { postDailyTweet } from "./tweet-api";
import type { DailyData, DailyItem } from "./types";

export function getJstDateString(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

async function writeJson(filePath: string, data: DailyData) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function isEnvFlagEnabled(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

// ────────────────────────────────────────────────────────────
// 1. 生成: RSS + AI + FANZA → DailyData（ファイルI/Oなし）
// ────────────────────────────────────────────────────────────
export async function generateDailyData(date: string): Promise<DailyData> {
  const articles = await fetchArticles();
  const selected = await selectAndGenerateItems(articles);

  const items: DailyItem[] = await Promise.all(
    selected.map(async (entry, index) => {
      const campaign = `${date}-item${index + 1}`;
      const product = await fetchFanzaProduct(entry.genreKeyword, campaign);
      return {
        id: index + 1,
        newsTitle: entry.newsTitle,
        genre: entry.genreKeyword,
        reason: entry.reason,
        shareText: entry.shareText,
        product,
      };
    }),
  );

  return { date, items };
}

// ────────────────────────────────────────────────────────────
// 2. 保存: date.json・latest.json を書き出す
// ────────────────────────────────────────────────────────────
export async function persistDailyData(
  date: string,
  data: DailyData,
  options: { updateLatest: boolean },
): Promise<void> {
  const dataDir = path.join(process.cwd(), "data");
  await writeJson(path.join(dataDir, `${date}.json`), data);
  if (options.updateLatest) {
    await writeJson(path.join(dataDir, "latest.json"), data);
  }
}

// ────────────────────────────────────────────────────────────
// 3. 発火: deploy + tweet（SKIP フラグに従う）
// ────────────────────────────────────────────────────────────
export async function publishDailyData(date: string, data: DailyData): Promise<void> {
  const sideEffectEntries = [
    !isEnvFlagEnabled("SKIP_DEPLOY_HOOK") ? { name: "deploy", run: () => triggerDeploy() } : null,
    !isEnvFlagEnabled("SKIP_TWEET") ? { name: "twitter", run: () => postDailyTweet(data) } : null,
  ].filter((entry): entry is { name: string; run: () => Promise<void> } => entry !== null);

  if (sideEffectEntries.length === 0) return;

  const results = await Promise.allSettled(sideEffectEntries.map((e) => e.run()));
  const failures = results.filter((r) => r.status === "rejected");

  for (const [i, result] of results.entries()) {
    if (result.status === "rejected") {
      console.warn(`Side effect [${sideEffectEntries[i].name}] failed for ${date}:`, (result as PromiseRejectedResult).reason);
    }
  }

  if (failures.length === results.length) {
    throw new Error(
      `All publish side effects failed: ${failures
        .map((r) => String((r as PromiseRejectedResult).reason))
        .join("; ")}`,
    );
  }
}

// ────────────────────────────────────────────────────────────
// エントリーポイント: 日次バッチ（generate + persist + publish）
// ────────────────────────────────────────────────────────────
export async function runBatch(date = getJstDateString()): Promise<DailyData> {
  const data = await generateDailyData(date);
  await persistDailyData(date, data, { updateLatest: true });
  await publishDailyData(date, data);
  return data;
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "batch.ts"));

if (isDirectExecution) {
  runBatch()
    .then((data) => {
      console.log(`Batch completed for ${data.date} (${data.items.length} items).`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npm test -- tests/batch.test.ts
```

Expected: 3 tests PASS。

- [ ] **Step 5: 全テスト・型チェック通過確認**

```bash
npm run typecheck && npm run lint && npm test
```

Expected: すべて PASS。

- [ ] **Step 6: コミット**

```bash
git add scripts/batch.ts tests/batch.test.ts
git commit -m "refactor: split runBatch into generateDailyData/persistDailyData/publishDailyData"
```

---

## Task 3: Phase 2 — seed.ts + data/status.json

**Files:**
- Create: `scripts/seed.ts`
- Create: `data/status.json`
- Modify: `scripts/batch.ts`
- Modify: `tests/batch.test.ts`

過去14日分のデータを deploy/tweet なしで安全に生成できる seed スクリプトを作る。`data/status.json` で冪等性を管理する。

- [ ] **Step 1: status.json のテストを batch.test.ts に追記**

`tests/batch.test.ts` の末尾に以下のテストを追加する:

```typescript
describe("readStatus / writeStatus", () => {
  it("存在しない場合は空オブジェクトを返す", async () => {
    const { readStatus } = await import("../scripts/batch");
    const status = await readStatus();
    expect(status).toEqual({});
  });

  it("writeStatus → readStatus で往復できる", async () => {
    const { readStatus, writeStatus } = await import("../scripts/batch");
    await writeStatus({
      "2026-04-07": { generated: true, persisted: true, deployed: false, tweeted: false },
    });
    const loaded = await readStatus();
    expect(loaded["2026-04-07"].persisted).toBe(true);
    expect(loaded["2026-04-07"].tweeted).toBe(false);
  });
});

describe("persistDailyData with status", () => {
  it("persisted:true の日付はスキップされる", async () => {
    const { generateDailyData, persistDailyData, writeStatus } = await import("../scripts/batch");
    await writeStatus({ "2026-04-07": { generated: true, persisted: true, deployed: false, tweeted: false } });

    const data = await generateDailyData("2026-04-07");
    await persistDailyData("2026-04-07", data, { updateLatest: false });

    // スキップされたのでファイルが書かれないことを確認
    const exists = await fs.access(path.join(tempRoot, "data", "2026-04-07.json")).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npm test -- tests/batch.test.ts
```

Expected: `readStatus is not a function` / `writeStatus is not a function` で FAIL。

- [ ] **Step 3: batch.ts に readStatus / writeStatus を追加し、persistDailyData にスキップロジックを追加**

`scripts/batch.ts` の `writeJson` 関数の直後（`isEnvFlagEnabled` の前）に以下を挿入する:

```typescript
// ────────────────────────────────────────────────────────────
// status.json ユーティリティ
// ────────────────────────────────────────────────────────────
export interface DateStatus {
  generated: boolean;
  persisted: boolean;
  deployed: boolean;
  tweeted: boolean;
}

export type StatusMap = Record<string, DateStatus>;

export async function readStatus(): Promise<StatusMap> {
  const statusPath = path.join(process.cwd(), "data", "status.json");
  try {
    const raw = await fs.readFile(statusPath, "utf8");
    return JSON.parse(raw) as StatusMap;
  } catch {
    return {};
  }
}

export async function writeStatus(status: StatusMap): Promise<void> {
  const dataDir = path.join(process.cwd(), "data");
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(
    path.join(dataDir, "status.json"),
    JSON.stringify(status, null, 2),
    "utf8",
  );
}
```

`persistDailyData` 関数を以下に置き換える（スキップロジック追加）:

```typescript
export async function persistDailyData(
  date: string,
  data: DailyData,
  options: { updateLatest: boolean },
): Promise<void> {
  const status = await readStatus();
  if (status[date]?.persisted) {
    console.log(`persistDailyData: skipping ${date} (already persisted)`);
    return;
  }

  const dataDir = path.join(process.cwd(), "data");
  await writeJson(path.join(dataDir, `${date}.json`), data);
  if (options.updateLatest) {
    await writeJson(path.join(dataDir, "latest.json"), data);
  }

  const updated: StatusMap = {
    ...status,
    [date]: { ...status[date], generated: true, persisted: true, deployed: status[date]?.deployed ?? false, tweeted: status[date]?.tweeted ?? false },
  };
  await writeStatus(updated);
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npm test -- tests/batch.test.ts
```

Expected: すべて PASS。

- [ ] **Step 5: scripts/seed.ts を新規作成**

```typescript
import { generateDailyData, getJstDateString, persistDailyData, readStatus } from "./batch";

function last14Days(anchor = getJstDateString()): string[] {
  const dates: string[] = [];
  const anchorDate = new Date(`${anchor}T00:00:00+09:00`);
  for (let i = 13; i >= 0; i--) {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() - i);
    dates.push(
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d),
    );
  }
  return dates;
}

async function seed(anchorDate?: string): Promise<void> {
  const dates = last14Days(anchorDate);
  const status = await readStatus();

  console.log(`Seeding ${dates.length} dates: ${dates[0]} → ${dates[dates.length - 1]}`);

  for (const date of dates) {
    if (status[date]?.persisted) {
      console.log(`  [SKIP] ${date} already persisted`);
      continue;
    }
    console.log(`  [GEN]  ${date} generating...`);
    const data = await generateDailyData(date);
    await persistDailyData(date, data, { updateLatest: false });
    console.log(`  [DONE] ${date} persisted`);
  }

  console.log("Seed complete.");
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "seed.ts"));

if (isDirectExecution) {
  const anchorArg = process.argv[2];
  seed(anchorArg)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

import path from "node:path";
export { seed, last14Days };
```

**注意:** import 文を先頭に移動する必要がある。以下が正しい `seed.ts` の完全版:

```typescript
import path from "node:path";
import { generateDailyData, getJstDateString, persistDailyData, readStatus } from "./batch";

function last14Days(anchor = getJstDateString()): string[] {
  const dates: string[] = [];
  const anchorDate = new Date(`${anchor}T00:00:00+09:00`);
  for (let i = 13; i >= 0; i--) {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() - i);
    dates.push(
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d),
    );
  }
  return dates;
}

export async function seed(anchorDate?: string): Promise<void> {
  const dates = last14Days(anchorDate);
  const status = await readStatus();

  console.log(`Seeding ${dates.length} dates: ${dates[0]} → ${dates[dates.length - 1]}`);

  for (const date of dates) {
    if (status[date]?.persisted) {
      console.log(`  [SKIP] ${date} already persisted`);
      continue;
    }
    console.log(`  [GEN]  ${date} generating...`);
    const data = await generateDailyData(date);
    await persistDailyData(date, data, { updateLatest: false });
    console.log(`  [DONE] ${date} persisted`);
  }

  console.log("Seed complete.");
}

export { last14Days };

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "seed.ts"));

if (isDirectExecution) {
  const anchorArg = process.argv[2];
  seed(anchorArg)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
```

- [ ] **Step 6: data/status.json の初期ファイルを作成**

```bash
echo '{}' > data/status.json
```

- [ ] **Step 7: package.json に seed スクリプトを追加**

`package.json` の `scripts` セクションに以下を追加する:

```json
"seed": "tsx scripts/seed.ts"
```

- [ ] **Step 8: seed テストを新規作成**

`tests/seed.test.ts` を以下の内容で作成する:

```typescript
import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/rss", () => ({
  fetchArticles: vi.fn().mockResolvedValue([
    { title: "ニュース", description: "概要", link: "https://example.com" },
  ]),
}));

vi.mock("../scripts/ai", () => ({
  selectAndGenerateItems: vi.fn().mockResolvedValue([
    { newsTitle: "ニュース", genreKeyword: "熟女", reason: "理由", shareText: "シェア文" },
  ]),
}));

vi.mock("../scripts/fanza", () => ({
  fetchFanzaProduct: vi.fn().mockResolvedValue({
    title: "作品",
    thumbnailUrl: "/fallback-thumb.png",
    affiliateUrlSingle: "https://example.com/single",
    affiliateUrlMonthly: "https://example.com/monthly",
    isFallback: true,
  }),
}));

vi.mock("../scripts/deploy", () => ({ triggerDeploy: vi.fn() }));
vi.mock("../scripts/tweet-api", () => ({ postDailyTweet: vi.fn() }));

const tempRoot = path.join(process.cwd(), ".tmp-seed-test");
const originalCwd = process.cwd();

beforeEach(async () => {
  await fs.mkdir(tempRoot, { recursive: true });
  process.chdir(tempRoot);
  vi.resetModules();
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe("seed", () => {
  it("指定日付分の date.json を生成し latest.json は作らない", async () => {
    const { seed } = await import("../scripts/seed");
    await seed("2026-04-09");

    // 14日分のファイルが存在する
    const dataDir = path.join(tempRoot, "data");
    const files = await fs.readdir(dataDir);
    const dateFiles = files.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
    expect(dateFiles).toHaveLength(14);

    // latest.json は作られない
    const latestExists = await fs
      .access(path.join(dataDir, "latest.json"))
      .then(() => true)
      .catch(() => false);
    expect(latestExists).toBe(false);
  });

  it("persisted:true の日付はスキップする", async () => {
    const { seed, last14Days } = await import("../scripts/seed");
    const { writeStatus } = await import("../scripts/batch");
    const dates = last14Days("2026-04-09");

    // 最初の3日分を既存として登録
    const alreadyDone = dates.slice(0, 3).reduce<Record<string, { generated: boolean; persisted: boolean; deployed: boolean; tweeted: boolean }>>(
      (acc, d) => ({ ...acc, [d]: { generated: true, persisted: true, deployed: false, tweeted: false } }),
      {},
    );
    await writeStatus(alreadyDone);

    await seed("2026-04-09");

    const dataDir = path.join(tempRoot, "data");
    const files = await fs.readdir(dataDir);
    const dateFiles = files.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));

    // 既存3件はスキップされ 11件だけ新規作成
    expect(dateFiles).toHaveLength(11);
  });

  it("deploy と tweet は一切呼ばれない", async () => {
    const { triggerDeploy } = await import("../scripts/deploy");
    const { postDailyTweet } = await import("../scripts/tweet-api");
    const { seed } = await import("../scripts/seed");

    await seed("2026-04-09");

    expect(triggerDeploy).not.toHaveBeenCalled();
    expect(postDailyTweet).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 9: 全テスト通過確認**

```bash
npm run typecheck && npm run lint && npm test
```

Expected: すべて PASS。

- [ ] **Step 10: コミット**

```bash
git add scripts/batch.ts scripts/seed.ts tests/batch.test.ts tests/seed.test.ts data/status.json package.json
git commit -m "feat: add seed.ts + status.json for idempotent backfill without deploy/tweet"
```

---

## Task 4: Phase 3 — FanzaProduct.isFallback + affiliateUrl バグ修正

**Files:**
- Modify: `scripts/types.ts`
- Modify: `scripts/fanza.ts`, `tests/fanza.test.ts`
- Modify: `src/app/components/NewsCard.tsx`
- Modify: `tests/tweet-api.test.ts` (FanzaProduct 型の更新に伴うモック修正)

fallback 状態を `isFallback` フラグで明示し、`affiliateUrlSingle/Monthly` が空になるバグを修正する。

- [ ] **Step 1: fanza.test.ts に isFallback テストを追加**

`tests/fanza.test.ts` の末尾に追加:

```typescript
  it("API成功時は isFallback: false を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            items: [
              {
                iteminfo: {
                  title: "作品タイトル",
                  affiliateURL: "https://example.com/single",
                  imageURL: { large: "https://pics.dmm.co.jp/thumb.jpg" },
                },
              },
            ],
          },
        }),
      }),
    );

    const product = await fetchFanzaProduct("熟女", "2026-04-07-item1");
    expect(product.isFallback).toBe(false);
  });

  it("API失敗時は isFallback: true を返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    const product = await fetchFanzaProduct("熟女", "2026-04-07-item1");
    expect(product.isFallback).toBe(true);
  });

  it("FANZA_MONTHLY_AFFILIATE_URL が空文字の場合もフォールバックURLが空にならない", async () => {
    process.env.FANZA_MONTHLY_AFFILIATE_URL = "";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("api down")));

    const product = await fetchFanzaProduct("熟女", "2026-04-07-item1");
    expect(product.affiliateUrlMonthly).not.toBe("");
    expect(product.affiliateUrlMonthly).toContain("dmm.co.jp");
  });
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npm test -- tests/fanza.test.ts
```

Expected: `isFallback` が存在しないため型エラー / undefined で FAIL。

- [ ] **Step 3: scripts/types.ts に isFallback を追加**

`scripts/types.ts` の `FanzaProduct` interface を以下に変更:

```typescript
export interface FanzaProduct {
  title: string;
  thumbnailUrl: string;
  affiliateUrlSingle: string;
  affiliateUrlMonthly: string;
  isFallback: boolean;
}
```

- [ ] **Step 4: scripts/fanza.ts を修正**

`getFallbackProduct` 関数を以下に変更する（空文字バグ修正 + `isFallback: true`）:

```typescript
function getFallbackProduct(genreKeyword: string, campaign: string): FanzaProduct {
  const rawUrl = process.env.FANZA_MONTHLY_AFFILIATE_URL?.trim();
  const defaultUrl =
    rawUrl && rawUrl.length > 0
      ? rawUrl
      : "https://www.dmm.co.jp/digital/videoa/-/list/=/";

  return {
    title: `${genreKeyword} のおすすめ作品`,
    thumbnailUrl: FALLBACK_THUMBNAIL,
    affiliateUrlSingle: appendTrackingParams(defaultUrl, campaign, "single"),
    affiliateUrlMonthly: appendTrackingParams(defaultUrl, campaign, "monthly"),
    isFallback: true,
  };
}
```

`fetchFanzaProduct` の return 文（API成功時）を以下に変更:

```typescript
    return {
      title: picked.title ?? `${genreKeyword} のおすすめ作品`,
      thumbnailUrl: (() => {
        const url = picked.imageURL?.large ?? picked.imageURL?.list ?? picked.imageURL?.small;
        return url && isSafeThumbnailUrl(url) ? url : FALLBACK_THUMBNAIL;
      })(),
      affiliateUrlSingle: appendTrackingParams(picked.affiliateURL, campaign, "single"),
      affiliateUrlMonthly: appendTrackingParams(monthlyBase, campaign, "monthly"),
      isFallback: false,
    };
```

- [ ] **Step 5: fanza.test.ts の既存テストを isFallback 対応に修正**

`tests/fanza.test.ts` の「API失敗時でもフォールバック作品を返してバッチを止めない」テストを修正:

```typescript
  it("API失敗時でもフォールバック作品を返してバッチを止めない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    const product = await fetchFanzaProduct("熟女", "2026-04-07-item1");

    expect(product.title).toBe("熟女 のおすすめ作品");
    expect(product.thumbnailUrl).toBe("/fallback-thumb.png");
    expect(product.isFallback).toBe(true);
    expect(product.affiliateUrlMonthly).not.toBe("");
  });
```

- [ ] **Step 6: tweet-api.test.ts のモックに isFallback を追加**

`tests/tweet-api.test.ts` の product オブジェクト全箇所に `isFallback: false` を追加:

```typescript
    product: {
      title: "作品名",
      thumbnailUrl: "/fallback-thumb.png",
      affiliateUrlSingle: "https://example.com/single",
      affiliateUrlMonthly: "https://example.com/monthly",
      isFallback: false,
    },
```

- [ ] **Step 7: NewsCard.tsx を isFallback フラグに基づいた CTA 分岐に変更**

`src/app/components/NewsCard.tsx` の CTA 部分（`<div className="mt-5 grid gap-3">` 以降）を以下に変更:

```tsx
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
```

また、`const thumbnailUrl = item.product.thumbnailUrl || "/fallback-thumb.png";` 行を以下に変更（`isFallback` フラグがあれば thumbnailUrl は信頼できるが念のため維持）:

```tsx
  const thumbnailUrl = item.product.thumbnailUrl || "/fallback-thumb.png";
```

（この行は変更不要。ただし既存の `thumbnailUrl` ベースのフォールバック判定がある場合は削除する）

- [ ] **Step 8: 全テスト通過確認**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Expected: すべて PASS。

- [ ] **Step 9: コミット**

```bash
git add scripts/types.ts scripts/fanza.ts src/app/components/NewsCard.tsx tests/fanza.test.ts tests/tweet-api.test.ts tests/batch.test.ts tests/seed.test.ts
git commit -m "feat: add FanzaProduct.isFallback flag and fix empty affiliateUrl bug"
```

---

## Task 5: Phase 4 — About / Privacy / Footer 追加

**Files:**
- Create: `src/app/about/page.tsx`
- Create: `src/app/privacy/page.tsx`
- Create: `src/app/components/Footer.tsx`
- Modify: `src/app/layout.tsx`

DMMアフィリエイト審査担当者がサイトの方向性を判断できる状態にする。

- [ ] **Step 1: Footer コンポーネントを作成**

`src/app/components/Footer.tsx` を以下の内容で作成:

```tsx
export function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-200 py-8 text-center text-xs text-slate-400">
      <nav className="flex justify-center gap-6">
        <a href="/about" className="hover:text-slate-600 transition">
          このサイトについて
        </a>
        <a href="/privacy" className="hover:text-slate-600 transition">
          プライバシーポリシー
        </a>
      </nav>
      <p className="mt-4">
        当サイトはFANZAアフィリエイトプログラムに参加しています。
      </p>
      <p className="mt-2">
        © {new Date().getFullYear()} せっかくだから俺はこのニュースで抜くぜ
      </p>
    </footer>
  );
}
```

- [ ] **Step 2: layout.tsx に Footer を追加**

`src/app/layout.tsx` の `<body>` 内の `{children}` の後に `<Footer />` を追加:

```tsx
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Footer } from "./components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "せっかくだから俺はこのニュースで抜くぜ",
  description: "今日のニュースをAVジャンルに変換して毎日5本届けるネタサイトです。",
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        {children}
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: About ページを作成**

`src/app/about/page.tsx` を以下の内容で作成:

```tsx
import type { Metadata } from "next";
import { Header } from "../components/Header";

export const metadata: Metadata = {
  title: "このサイトについて | せっかくだから俺はこのニュースで抜くぜ",
  description: "ニュースとAVジャンルを結びつけるユーモアサイトの趣旨・更新頻度・免責事項について。",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      <Header date={new Date().toISOString().slice(0, 10)} />
      <div className="mx-auto max-w-lg px-4 py-10 prose prose-slate">
        <h1 className="text-2xl font-bold text-slate-900">このサイトについて</h1>

        <h2 className="mt-8 text-lg font-bold text-slate-900">サイトの趣旨</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          「せっかくだから俺はこのニュースで抜くぜ」は、毎日のニュース5本をAIが分析し、
          それぞれAVジャンルと結びつけるユーモアサイトです。
          政治・経済・スポーツ・国際ニュースが、どんなジャンルになるかは開いてのお楽しみ。
        </p>

        <h2 className="mt-8 text-lg font-bold text-slate-900">更新頻度</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          毎朝 JST 7:00 に自動更新されます。AIがその日のニュースを選定し、
          FANZA掲載作品と紐付けたコンテンツを自動生成しています。
        </p>

        <h2 className="mt-8 text-lg font-bold text-slate-900">成人向けコンテンツについて</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          本サイトには成人向けコンテンツ（アダルトビデオ）へのリンクが含まれます。
          18歳未満の方のご利用はお断りします。
          リンク先の外部サービスのコンテンツについて、当サイトは責任を負いません。
        </p>

        <h2 className="mt-8 text-lg font-bold text-slate-900">アフィリエイトについて</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          当サイトはFANZA（合同会社DMM.com）のアフィリエイトプログラムに参加しており、
          掲載リンクを経由してサービスをご利用いただいた場合、
          当サイトに報酬が発生することがあります。
        </p>

        <h2 className="mt-8 text-lg font-bold text-slate-900">お問い合わせ</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          X（旧Twitter）の{" "}
          <a
            href={`https://twitter.com/${process.env.NEXT_PUBLIC_TWITTER_HANDLE ?? "nukenews"}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-600 underline"
          >
            @{process.env.NEXT_PUBLIC_TWITTER_HANDLE ?? "nukenews"}
          </a>{" "}
          までご連絡ください。
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Privacy ページを作成**

`src/app/privacy/page.tsx` を以下の内容で作成:

```tsx
import type { Metadata } from "next";
import { Header } from "../components/Header";

export const metadata: Metadata = {
  title: "プライバシーポリシー | せっかくだから俺はこのニュースで抜くぜ",
  description: "アクセス解析・アフィリエイト・Cookieの利用についての方針。",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen">
      <Header date={new Date().toISOString().slice(0, 10)} />
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">プライバシーポリシー</h1>

        <h2 className="mt-8 text-lg font-bold text-slate-900">アクセス解析</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          当サイトでは Vercel Analytics を使用してアクセス状況を解析しています。
          収集したデータは個人を特定するものではなく、サイト改善のみに使用します。
        </p>

        <h2 className="mt-8 text-lg font-bold text-slate-900">アフィリエイトリンク</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          当サイトはFANZAアフィリエイトプログラムに参加しています。
          掲載リンクには UTM パラメーターが含まれる場合があります。
          これらはクリック計測・成果報酬確認のために使用するものであり、
          個人情報の収集は行いません。
        </p>

        <h2 className="mt-8 text-lg font-bold text-slate-900">Cookie</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          当サイト自体はCookieを発行しません。ただし、リンク先の外部サービス
          （FANZA等）がCookieを使用する場合があります。
        </p>

        <h2 className="mt-8 text-lg font-bold text-slate-900">お問い合わせ</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          プライバシーポリシーに関するご質問は X（旧Twitter）の{" "}
          <a
            href={`https://twitter.com/${process.env.NEXT_PUBLIC_TWITTER_HANDLE ?? "nukenews"}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-600 underline"
          >
            @{process.env.NEXT_PUBLIC_TWITTER_HANDLE ?? "nukenews"}
          </a>{" "}
          までお願いします。
        </p>

        <p className="mt-8 text-xs text-slate-400">最終更新: 2026-04-09</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: ビルド確認（/about・/privacy が生成されること）**

```bash
npm run build 2>&1 | grep -E "about|privacy|error|Error"
```

Expected: `/about` と `/privacy` がビルド出力に現れ、エラーなし。

- [ ] **Step 6: 全テスト通過確認**

```bash
npm run typecheck && npm run lint && npm test
```

Expected: すべて PASS。

- [ ] **Step 7: コミット**

```bash
git add src/app/about/page.tsx src/app/privacy/page.tsx src/app/components/Footer.tsx src/app/layout.tsx
git commit -m "feat: add About/Privacy pages and Footer for DMM affiliate review"
```

---

## Task 6: Phase 5 — AI プロンプト改善 + OGP ティザー演出 + CTA 強化

**Files:**
- Modify: `scripts/ai.ts`, `tests/ai.test.ts`
- Modify: `src/app/api/og/route.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/components/NewsCard.tsx` (metadata description のみ)

CVRに直結する UI・コンテンツ品質を上げる。

- [ ] **Step 1: ai.test.ts にフォールバック reason 多様性テストを追加**

`tests/ai.test.ts` の `describe("selectAndGenerateItems"` ブロックの末尾に追加:

```typescript
  it("フォールバック reason は記事タイトルを含む異なる文言になる", async () => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error("API down")),
      },
    }));

    const result = await selectAndGenerateItems(mockArticles);

    // 全 reason が異なること
    const reasons = result.map((item) => item.reason);
    const uniqueReasons = new Set(reasons);
    expect(uniqueReasons.size).toBe(reasons.length);

    // 各 reason が対応するニュースタイトルを含むこと
    for (const item of result) {
      expect(item.reason).toContain(item.newsTitle.slice(0, 5));
    }
  });

  it("フォールバック genreKeyword は最大3種類まで重複する", async () => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error("API down")),
      },
    }));

    const result = await selectAndGenerateItems(mockArticles);
    const genres = result.map((item) => item.genreKeyword);
    const genreCounts = genres.reduce<Record<string, number>>((acc, g) => {
      acc[g] = (acc[g] ?? 0) + 1;
      return acc;
    }, {});

    // 同一ジャンルが5件全部になることはない
    expect(Math.max(...Object.values(genreCounts))).toBeLessThan(5);
  });
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npm test -- tests/ai.test.ts
```

Expected: `reason` が全件同一テキストのためユニーク数テストが FAIL。

- [ ] **Step 3: scripts/ai.ts のフォールバック reason とジャンルを改善**

`scripts/ai.ts` の `inferGenreKeyword` と `buildFallbackItems` を以下に変更:

```typescript
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
```

また、`buildPrompt` の prompt に以下の一行を追加（`ルール:` セクションの末尾）:

```
- できるだけ異なる genreKeyword を使うこと（ただし検索ヒット率を優先）
```

具体的には `buildPrompt` 関数の `ルール:` セクションを以下に変更:

```typescript
  return `あなたはユーモラスなWebコンテンツキュレーターです。以下のニュース記事リストを分析し、AVジャンルと最も面白い接続が作れる5件を選んでください。

ルール:
- newsTitle はニュースタイトルの元の文言をそのまま使う
- genreKeyword は FANZA で検索しやすい日本語キーワードを1〜2語にする
- reason は自然な日本語で1〜2文、やや笑えるトーンにする
- shareText には作品名もジャンル名も入れない
- できるだけ異なる genreKeyword を使うこと（ただし検索ヒット率を優先）

ニュース記事リスト:
${articleList}`;
```

- [ ] **Step 4: ai.test.ts の既存テスト確認 + 新テスト通過確認**

```bash
npm test -- tests/ai.test.ts
```

Expected: すべて PASS。

- [ ] **Step 5: og/route.tsx を OGP ティザー演出に変更**

`src/app/api/og/route.tsx` のメインコンテンツ部分（`<div style={{ display: "flex", flexDirection: "column"...` 以降）を以下に変更:

```tsx
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "64px 80px",
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ fontSize: 22, opacity: 0.65, letterSpacing: "0.15em" }}>NUKE NEWS</div>
          <div
            style={{
              marginTop: 16,
              fontSize: 40,
              fontWeight: 700,
              lineHeight: 1.4,
              color: "#f1f5f9",
            }}
          >
            {item?.newsTitle ?? "今日のニュースがジャンルに変換されました"}
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 88,
              fontWeight: 900,
              color: "#ef4444",
              letterSpacing: "0.1em",
            }}
          >
            ???
          </div>
          <div style={{ marginTop: 20, fontSize: 22, color: "#94a3b8" }}>
            答えはサイトで
          </div>
        </div>
```

- [ ] **Step 6: page.tsx の metadata description を固定キャッチコピーに変更**

`src/app/page.tsx` の `generateMetadata` 関数の `description` と `openGraph.description` を変更:

```typescript
export async function generateMetadata(): Promise<Metadata> {
  const data = loadLatestData();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nukenews.vercel.app";
  const date = data?.date ?? new Date().toISOString().slice(0, 10);

  return {
    title: "せっかくだから俺はこのニュースで抜くぜ",
    description: "今日のニュース5本が、AIによって全く別のジャンルに変換されました。答えはサイトで。",
    openGraph: {
      title: "せっかくだから俺はこのニュースで抜くぜ",
      description: "今日のニュース5本が、AIによって全く別のジャンルに変換されました。答えはサイトで。",
      url: siteUrl,
      images: [{ url: `${siteUrl}/api/og?date=${date}&id=1` }],
    },
    twitter: {
      card: "summary_large_image",
      images: [`${siteUrl}/api/og?date=${date}&id=1`],
    },
  };
}
```

- [ ] **Step 7: 全テスト・ビルド通過確認**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Expected: すべて PASS。

- [ ] **Step 8: コミット**

```bash
git add scripts/ai.ts tests/ai.test.ts src/app/api/og/route.tsx src/app/page.tsx
git commit -m "feat: improve fallback reason diversity, OGP teaser design, and metadata description"
```

---

## Task 7: Phase 6 — genre-index.json + ジャンルアーカイブ + サイトマップ

**Files:**
- Modify: `scripts/batch.ts`, `tests/batch.test.ts`
- Modify: `src/app/lib/data.ts`
- Create: `src/app/genre/[genre]/page.tsx`
- Create: `src/app/sitemap.ts`

SEO自然流入とバッチ時インデックス生成で build/request 時の全走査を排除する。

- [ ] **Step 1: genre-index テストを batch.test.ts に追加**

`tests/batch.test.ts` の末尾に追加:

```typescript
describe("genre-index.json", () => {
  it("persistDailyData 後に genre-index.json が更新される", async () => {
    const { generateDailyData, persistDailyData } = await import("../scripts/batch");
    const data = await generateDailyData("2026-04-07");
    await persistDailyData("2026-04-07", data, { updateLatest: false });

    const indexPath = path.join(tempRoot, "data", "genre-index.json");
    const exists = await fs.access(indexPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const index = JSON.parse(await fs.readFile(indexPath, "utf8")) as Record<string, Array<{ date: string; itemId: number }>>;
    // genre が存在すること（fanza mock は熟女を返す）
    const allEntries = Object.values(index).flat();
    expect(allEntries.some((e) => e.date === "2026-04-07")).toBe(true);
  });

  it("同日2回実行しても genre-index に重複エントリが生まれない", async () => {
    const { generateDailyData, persistDailyData } = await import("../scripts/batch");
    const data = await generateDailyData("2026-04-07");

    // status をリセットして2回実行できるようにする
    await persistDailyData("2026-04-07", data, { updateLatest: false });
    // 2回目: persisted フラグでスキップされるので genre-index は変化しない
    await persistDailyData("2026-04-07", data, { updateLatest: false });

    const indexPath = path.join(tempRoot, "data", "genre-index.json");
    const index = JSON.parse(await fs.readFile(indexPath, "utf8")) as Record<string, Array<{ date: string; itemId: number }>>;
    const allEntries = Object.values(index).flat();
    const apr07Entries = allEntries.filter((e) => e.date === "2026-04-07");

    // 5件（アイテム数）以内であること（重複なし）
    expect(apr07Entries.length).toBeLessThanOrEqual(5);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npm test -- tests/batch.test.ts
```

Expected: genre-index.json が存在しないため FAIL。

- [ ] **Step 3: batch.ts に updateGenreIndex を追加し persistDailyData から呼ぶ**

`scripts/batch.ts` の `writeStatus` 関数の直後に以下を追加:

```typescript
async function updateGenreIndex(date: string, items: DailyItem[]): Promise<void> {
  const indexPath = path.join(process.cwd(), "data", "genre-index.json");
  let index: Record<string, Array<{ date: string; itemId: number }>> = {};

  try {
    const raw = await fs.readFile(indexPath, "utf8");
    index = JSON.parse(raw) as typeof index;
  } catch {
    // 存在しない場合は空から開始
  }

  for (const item of items) {
    const genre = item.genre;
    if (!index[genre]) index[genre] = [];
    // 同日・同アイテムの重複を除去してから先頭に追加
    index[genre] = index[genre].filter((e) => !(e.date === date && e.itemId === item.id));
    index[genre].unshift({ date, itemId: item.id });
  }

  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), "utf8");
}
```

`persistDailyData` 関数内の `writeStatus(updated)` 呼び出しの直前に以下を追加:

```typescript
  await updateGenreIndex(date, data.items);
```

（つまり `writeStatus` の前で genre-index を更新する）

- [ ] **Step 4: テストが通ることを確認**

```bash
npm test -- tests/batch.test.ts
```

Expected: すべて PASS。

- [ ] **Step 5: data.ts に readGenreIndex と listDatesByGenre を追加**

`src/app/lib/data.ts` の末尾に追加:

```typescript
export type GenreIndex = Record<string, Array<{ date: string; itemId: number }>>;

export function readGenreIndex(): GenreIndex {
  const indexPath = path.join(DATA_DIR, "genre-index.json");
  if (!fs.existsSync(indexPath)) return {};
  try {
    const raw = fs.readFileSync(indexPath, "utf8");
    return JSON.parse(raw) as GenreIndex;
  } catch {
    return {};
  }
}

export function listDatesByGenre(genre: string): Array<{ date: string; itemId: number }> {
  const index = readGenreIndex();
  return index[genre] ?? [];
}

export function listAllGenres(): string[] {
  return Object.keys(readGenreIndex());
}
```

- [ ] **Step 6: ジャンルアーカイブページを作成**

`src/app/genre/[genre]/page.tsx` を以下の内容で作成:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "../../components/Header";
import { listAllGenres, listDatesByGenre, loadDailyData } from "../../lib/data";

interface Props {
  params: Promise<{ genre: string }>;
}

export async function generateStaticParams() {
  return listAllGenres().map((genre) => ({
    genre: encodeURIComponent(genre),
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { genre } = await params;
  const decoded = decodeURIComponent(genre);
  return {
    title: `${decoded} のニュース一覧 | せっかくだから俺はこのニュースで抜くぜ`,
    description: `AIが「${decoded}」ジャンルと紐付けたニュース一覧。`,
  };
}

export default async function GenrePage({ params }: Props) {
  const { genre } = await params;
  const decoded = decodeURIComponent(genre);
  const entries = listDatesByGenre(decoded);

  const items = entries
    .map(({ date, itemId }) => {
      const data = loadDailyData(date);
      const item = data?.items.find((i) => i.id === itemId);
      return item ? { date, item } : null;
    })
    .filter((x): x is { date: string; item: NonNullable<typeof x>["item"] } => x !== null);

  return (
    <main className="min-h-screen">
      <Header date={new Date().toISOString().slice(0, 10)} />
      <div className="mx-auto max-w-lg px-4 py-8">
        <h1 className="text-xl font-bold text-slate-900">
          ジャンル:{" "}
          <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-base font-semibold text-red-700">
            {decoded}
          </span>
        </h1>
        <p className="mt-1 text-sm text-slate-500">{items.length} 件</p>

        <ul className="mt-6 flex flex-col gap-3">
          {items.map(({ date, item }) => (
            <li key={`${date}-${item.id}`}>
              <Link
                href={`/${date}#item-${item.id}`}
                className="block rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:shadow-md"
              >
                <p className="text-xs text-slate-400">{date}</p>
                <p className="mt-1 text-sm font-bold text-slate-900 leading-snug">
                  {item.newsTitle}
                </p>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">{item.reason}</p>
              </Link>
            </li>
          ))}
          {items.length === 0 && (
            <li className="text-sm text-slate-400 text-center py-8">
              このジャンルのコンテンツはまだありません
            </li>
          )}
        </ul>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: サイトマップを作成**

`src/app/sitemap.ts` を以下の内容で作成:

```typescript
import type { MetadataRoute } from "next";
import { listAllGenres, listAvailableDates } from "./lib/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nukenews.vercel.app").replace(/\/$/, "");
  const dates = listAvailableDates();
  const genres = listAllGenres();

  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1.0 },
    { url: `${siteUrl}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/privacy`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const datePages: MetadataRoute.Sitemap = dates.map((date) => ({
    url: `${siteUrl}/${date}`,
    changeFrequency: "never" as const,
    priority: 0.8,
    lastModified: new Date(`${date}T07:00:00+09:00`),
  }));

  const genrePages: MetadataRoute.Sitemap = genres.map((genre) => ({
    url: `${siteUrl}/genre/${encodeURIComponent(genre)}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...datePages, ...genrePages];
}
```

- [ ] **Step 8: 全テスト・ビルド通過確認**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Expected: すべて PASS。サイトマップが生成されることを確認:

```bash
npm run build 2>&1 | grep -E "sitemap|genre|error|Error"
```

- [ ] **Step 9: コミット**

```bash
git add scripts/batch.ts src/app/lib/data.ts src/app/genre src/app/sitemap.ts tests/batch.test.ts
git commit -m "feat: add genre-index.json, genre archive pages, and sitemap"
```

---

## 最終確認チェックリスト

- [ ] `npm run typecheck` — 型エラーなし
- [ ] `npm run lint` — lint エラーなし
- [ ] `npm test` — 全テスト PASS
- [ ] `npm run build` — ビルド成功
- [ ] `/about` と `/privacy` がビルド出力に含まれること
- [ ] `data/genre-index.json` がバッチ後に生成されること（seed 実行で確認）
- [ ] `data/status.json` が `{}` として git 管理されていること
- [ ] `scripts/twitter.ts` が削除されていること

---

## ビジネスマイルストーン対応

| マイルストーン | 必要なTask |
|--------------|-----------|
| **DMMアフィリエイト再申請** | Task 1〜5 完了後（Phase 0〜4） |
| **収益起動**（審査通過後） | `FANZA_API_ID` / `FANZA_AFFILIATE_ID` を Vercel 環境変数に設定するだけで即起動 |
| **CVR最大化** | Task 6 完了後（Phase 5） |
| **SEO・X成長** | Task 7 完了後（Phase 6） |

---

## 実装ガードレール（絶対に守ること）

1. **`seed.ts` から `publishDailyData` を呼ばない** — deploy/tweet が最大14回誤発火する
2. **`date.json exists => skip` を冪等性と呼ばない** — `data/status.json` の `persisted` フラグで管理する
3. **build/request 時に `data/*.json` を全走査しない** — `data/genre-index.json` 経由で listDatesByGenre を使う
4. **UI で fallback を `thumbnailUrl` から推測しない** — `product.isFallback` フラグのみを使う
5. **`FANZA_MONTHLY_AFFILIATE_URL` が空文字の場合にデフォルト URL を必ず使う** — `appendTrackingParams("")` は空文字を返す
