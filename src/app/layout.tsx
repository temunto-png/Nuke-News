import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Footer } from "./components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "せっかくだから俺はこのニュースで抜くぜ",
  description: "今日のニュースをAVジャンルに変換して毎日5本届けるネタサイトです。",
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        {children}
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
