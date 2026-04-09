import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NewsCard } from "../../src/app/components/NewsCard";
import type { DailyItem } from "../../scripts/types";

const item: DailyItem = {
  id: 1,
  newsTitle: "日銀、金利据え置きを決定",
  genre: "熟女",
  reason: "長年の経験で培った安定した手さばきが、今の日本経済にそのまま重なった。",
  shareText: "このニュースで選ばれた作品、絶対わからんと思う。",
  product: {
    title: "作品タイトル",
    thumbnailUrl: "https://example.com/thumb.jpg",
    affiliateUrlSingle: "https://example.com/single",
    affiliateUrlMonthly: "https://example.com/monthly",
    isFallback: false,
  },
};

const fallbackItem: DailyItem = {
  id: 2,
  newsTitle: "フォールバックニュース",
  genre: "人妻",
  reason: "フォールバック理由",
  shareText: "フォールバックシェアテキスト",
  product: {
    title: "人妻 のおすすめ作品",
    thumbnailUrl: "/fallback-thumb.png",
    affiliateUrlSingle: "https://www.dmm.co.jp/digital/videoa/-/list/=/",
    affiliateUrlMonthly: "https://www.dmm.co.jp/digital/videoa/-/list/=/",
    isFallback: true,
  },
};

describe("NewsCard", () => {
  it("ニュースタイトルと作品タイトルを表示する", () => {
    render(<NewsCard item={item} date="2026-04-07" />);

    expect(screen.getByText("日銀、金利据え置きを決定")).toBeInTheDocument();
    expect(screen.getByText("作品タイトル")).toBeInTheDocument();
  });

  it("理由文を表示する", () => {
    render(<NewsCard item={item} date="2026-04-07" />);
    expect(screen.getByText(/長年の経験/)).toBeInTheDocument();
  });

  it("単品CTAを表示する", () => {
    render(<NewsCard item={item} date="2026-04-07" />);
    expect(screen.getByRole("link", { name: "作品を見る →" })).toHaveAttribute(
      "href",
      "https://example.com/single",
    );
  });

  it("月額CTAを表示する", () => {
    render(<NewsCard item={item} date="2026-04-07" />);
    expect(screen.getByRole("link", { name: "月額プランで全部見放題にする" })).toHaveAttribute(
      "href",
      "https://example.com/monthly",
    );
  });

  it("isFallback: true の時「今日の作品を探す →」を表示する", () => {
    render(<NewsCard item={fallbackItem} date="2026-04-07" />);
    expect(screen.getByRole("link", { name: "今日の作品を探す →" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "作品を見る →" })).toBeNull();
  });

  it("XシェアURLを生成する", () => {
    render(<NewsCard item={item} date="2026-04-07" />);
    expect(screen.getByRole("link", { name: "𝕏 シェア" }).getAttribute("href")).toContain(
      "twitter.com/intent/tweet",
    );
  });
});
