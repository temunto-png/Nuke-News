import type { Metadata } from "next";
import { ArchiveList } from "./components/ArchiveList";
import { Header } from "./components/Header";
import { NewsCard } from "./components/NewsCard";
import { getJstDateString } from "./lib/date";
import { listAvailableDates, loadLatestData } from "./lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const data = loadLatestData();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nukenews.vercel.app";
  const date = data?.date ?? getJstDateString();

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

export default function HomePage() {
  const data = loadLatestData();
  const today = data?.date ?? getJstDateString();
  const dates = listAvailableDates();

  return (
    <main className="min-h-screen">
      <Header date={today} />
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pb-12 pt-5">
        {data && data.items.length > 0 ? (
          data.items.map((item) => <NewsCard key={item.id} item={item} date={today} />)
        ) : (
          <section className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center shadow-sm">
            <p className="text-4xl">📰</p>
            <p className="mt-4 text-sm font-medium text-slate-500">本日のコンテンツは準備中です</p>
          </section>
        )}

        <ArchiveList dates={dates.filter((date) => date !== today)} />
      </div>
    </main>
  );
}
