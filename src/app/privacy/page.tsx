import type { Metadata } from "next";
import { Header } from "../components/Header";

export const metadata: Metadata = {
  title: "プライバシーポリシー | せっかくだから俺はこのニュースで抜くぜ",
  description: "アクセス解析・アフィリエイト・Cookieの利用についての方針。",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen">
      <Header date={new Date().toISOString().slice(0, 10)} />
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">プライバシーポリシー</h1>

        <h2 className="mt-8 text-lg font-bold text-slate-900">アクセス解析</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          当サイトでは Vercel Analytics を使用してアクセス状況を解析しています。
          収集したデータは個人を特定するものではなく、サイト改善のみに使用します。
        </p>

        <h2 className="mt-8 text-lg font-bold text-slate-900">アフィリエイトリンク</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          当サイトはFANZAアフィリエイトプログラムに参加しています。
          掲載リンクには UTM パラメーターが含まれる場合があります。
          これらはクリック計測・成果報酬確認のために使用するものであり、
          個人情報の収集は行いません。
        </p>

        <h2 className="mt-8 text-lg font-bold text-slate-900">Cookie</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          当サイト自体はCookieを発行しません。ただし、リンク先の外部サービス
          （FANZA等）がCookieを使用する場合があります。
        </p>

        <h2 className="mt-8 text-lg font-bold text-slate-900">お問い合わせ</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          プライバシーポリシーに関するご質問は X（旧Twitter）の{" "}
          <a
            href={`https://twitter.com/${process.env.NEXT_PUBLIC_TWITTER_HANDLE ?? "nukenews"}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-600 underline"
          >
            @{process.env.NEXT_PUBLIC_TWITTER_HANDLE ?? "nukenews"}
          </a>{" "}
          までお願いします。
        </p>

        <p className="mt-8 text-xs text-slate-400">最終更新: 2026-04-09</p>
      </div>
    </main>
  );
}
