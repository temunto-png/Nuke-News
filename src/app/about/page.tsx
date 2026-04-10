import type { Metadata } from "next";
import { Header } from "../components/Header";

export const metadata: Metadata = {
  title: "このサイトについて | せっかくだから俺はこのニュースで抜くぜ",
  description: "ニュースとAVジャンルを結びつけるユーモアサイトの趣旨・更新頻度・免責事項について。",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      <Header date={new Date().toISOString().slice(0, 10)} />
      <div className="mx-auto max-w-lg px-4 py-10 prose prose-slate">
        <h1 className="text-2xl font-bold text-slate-900">このサイトについて</h1>

        <h2 className="mt-8 text-lg font-bold text-slate-900">サイトの趣旨</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          「せっかくだから俺はこのニュースで抜くぜ」は、毎日のニュース5本をAIが分析し、
          それぞれAVジャンルと結びつけるユーモアサイトです。
          政治・経済・スポーツ・国際ニュースが、どんなジャンルになるかは開いてのお楽しみ。
        </p>

        <h2 className="mt-8 text-lg font-bold text-slate-900">更新頻度</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          毎朝 JST 7:00 に自動更新されます。AIがその日のニュースを選定し、
          FANZA掲載作品と紐付けたコンテンツを自動生成しています。
        </p>

        <h2 className="mt-8 text-lg font-bold text-slate-900">成人向けコンテンツについて</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          本サイトには成人向けコンテンツ（アダルトビデオ）へのリンクが含まれます。
          18歳未満の方のご利用はお断りします。
          リンク先の外部サービスのコンテンツについて、当サイトは責任を負いません。
        </p>

        <h2 className="mt-8 text-lg font-bold text-slate-900">アフィリエイトについて</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          当サイトはFANZA（合同会社DMM.com）のアフィリエイトプログラムに参加しており、
          掲載リンクを経由してサービスをご利用いただいた場合、
          当サイトに報酬が発生することがあります。
        </p>

        <h2 className="mt-8 text-lg font-bold text-slate-900">お問い合わせ</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          X（旧Twitter）の{" "}
          <a
            href="https://twitter.com/testcas01383886"
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-600 underline"
          >
            @testcas01383886
          </a>{" "}
          までご連絡ください。
        </p>
      </div>
    </main>
  );
}
