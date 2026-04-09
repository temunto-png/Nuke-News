import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "../../components/Header";
import { getJstDateString } from "../../lib/date";
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
      <Header date={getJstDateString()} />
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
