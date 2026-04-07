import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArchiveList } from "../../src/app/components/ArchiveList";

describe("ArchiveList", () => {
  it("日付リストをリンクとして表示する", () => {
    render(<ArchiveList dates={["2026-04-07", "2026-04-06", "2026-04-05"]} />);

    expect(screen.getByText("2026-04-07")).toBeInTheDocument();
    expect(screen.getByText("2026-04-06")).toBeInTheDocument();
    expect(screen.getByText("2026-04-05")).toBeInTheDocument();
  });

  it("日付リストが空のとき何も表示しない", () => {
    const { container } = render(<ArchiveList dates={[]} />);
    expect(container.querySelector("a")).toBeNull();
  });
});
