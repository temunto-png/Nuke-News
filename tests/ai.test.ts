import { describe, expect, it, vi } from "vitest";
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
      shareText: "「日銀が金利を据え置いた」 このニュースで選ばれた作品、絶対わからんと思う。",
    },
    {
      newsTitle: "プロ野球選手が電撃引退",
      genreKeyword: "引退 熟年",
      reason: "華々しいキャリアの幕引き。もう一度だけ輝く姿を見せてくれた。",
      shareText: "電撃引退のニュース、どんな作品に変換されたか想像できる？",
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
  it("5件の選定結果を返す", async () => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "tool_use", id: "tool_1", name: "select_news_items", input: mockAiResponse }],
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

  it("tool_use ブロックがない場合はフォールバックで5件返す", async () => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "申し訳ありませんが..." }],
        }),
      },
    }));

    const result = await selectAndGenerateItems(mockArticles);
    expect(result).toHaveLength(5);
    expect(result[0].newsTitle).toBe("日銀、金利据え置きを決定");
  });

  it("AIが存在しないニュースタイトルを返した場合は除外して補完する", async () => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "tool_use",
              id: "tool_1",
              name: "select_news_items",
              input: {
                selected: [
                  {
                    newsTitle: "存在しないニュース",
                    genreKeyword: "熟女",
                    reason: "理由",
                    shareText: "シェア文",
                  },
                  mockAiResponse.selected[0],
                ],
              },
            },
          ],
        }),
      },
    }));

    const result = await selectAndGenerateItems(mockArticles);
    expect(result).toHaveLength(5);
    expect(result.some((item) => item.newsTitle === "存在しないニュース")).toBe(false);
  });
});
