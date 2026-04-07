import React from "react";
import Link from "next/link";

interface ArchiveListProps {
  dates: string[];
}

export function ArchiveList({ dates }: ArchiveListProps) {
  if (dates.length === 0) {
    return null;
  }

  return (
    <section className="pb-10 pt-8">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
        過去のアーカイブ
      </h2>
      <div className="flex flex-wrap gap-2">
        {dates.map((date) => (
          <Link
            key={date}
            href={`/${date}`}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            {date}
          </Link>
        ))}
      </div>
    </section>
  );
}
