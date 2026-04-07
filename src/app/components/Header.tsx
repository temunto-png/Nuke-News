import React from "react";
import Link from "next/link";

interface HeaderProps {
  date: string;
}

export function Header({ date }: HeaderProps) {
  const twitterHandle = process.env.NEXT_PUBLIC_TWITTER_HANDLE ?? "nukenews_jp";
  const formattedDate = date.replace(/-/g, ".");

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-lg flex-col gap-2 px-4 py-4">
        <Link href="/" className="block">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">
            Nuke News
          </p>
          <h1 className="mt-1 text-lg font-black leading-tight text-slate-950">
            せっかくだから俺は
            <br />
            このニュースで抜くぜ
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
