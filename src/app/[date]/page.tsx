import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchiveList } from "../components/ArchiveList";
import { Header } from "../components/Header";
import { NewsCard } from "../components/NewsCard";
import { listAvailableDates, loadDailyData } from "../lib/data";

interface PageProps {
  params: Promise<{ date: string }>;
}

export async function generateStaticParams() {
  return listAvailableDates().map((date) => ({ date }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params;
  const data = loadDailyData(date);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nukenews.vercel.app";

  if (!data) {
    return { title: "Not Found" };
  }

  return {
    title: `${date}のヌケニュース - せっかくだから俺はこのニュースで抜くぜ`,
    description: data.items.map((item) => item.newsTitle).join("、"),
    openGraph: {
      title: `${date}のヌケニュース`,
      url: `${siteUrl}/${date}`,
      images: [{ url: `${siteUrl}/api/og?date=${date}&id=1` }],
    },
    twitter: {
      card: "summary_large_image",
      images: [`${siteUrl}/api/og?date=${date}&id=1`],
    },
  };
}

export default async function DatePage({ params }: PageProps) {
  const { date } = await params;
  const data = loadDailyData(date);

  if (!data) {
    notFound();
  }

  const allDates = listAvailableDates();

  return (
    <main className="min-h-screen">
      <Header date={date} />
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pb-12 pt-5">
        {data.items.map((item) => (
          <NewsCard key={item.id} item={item} date={date} />
        ))}
        <ArchiveList dates={allDates.filter((value) => value !== date)} />
      </div>
    </main>
  );
}
