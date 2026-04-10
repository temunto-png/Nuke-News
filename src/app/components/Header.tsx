import React from "react";
import Link from "next/link";

interface HeaderProps {
  date: string;
}

export function Header({ date }: HeaderProps) {
  const twitterHandle = "testcas01383886";
  const formattedDate = date.replace(/-/g, ".");

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-lg flex-col gap-2 px-4 py-4">
        <Link href="/" className="block">
          <h1 className="text-lg font-black leading-tight text-slate-950 whitespace-nowrap">
            せっかくだから俺はこのニュースで抜くぜ
          </h1>
          <p className="mt-1 text-xs text-slate-500">{formattedDate} の5本</p>
        </Link>
        <a
          href={`https://twitter.com/${twitterHandle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 transition hover:bg-sky-100"
        >
          <span>𝕏</span>
          <span>@{twitterHandle} をフォローして毎日受け取る</span>
        </a>
      </div>
    </header>
  );
}
