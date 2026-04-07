import React from "react";
import "@testing-library/jest-dom";
import { vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    React.createElement("a", { href, ...props }, children)
  ),
}));
