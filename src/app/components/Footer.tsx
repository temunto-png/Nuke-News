import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-200 py-8 text-center text-xs text-slate-400">
      <nav className="flex justify-center gap-6">
        <Link href="/about" className="hover:text-slate-600 transition">
          このサイトについて
        </Link>
        <Link href="/privacy" className="hover:text-slate-600 transition">
          プライバシーポリシー
        </Link>
      </nav>
      <p className="mt-4">
        当サイトはFANZAアフィリエイトプログラムに参加しています。
      </p>
      <p className="mt-2">
        © {new Date().getFullYear()} せっかくだから俺はこのニュースで抜くぜ
      </p>
    </footer>
  );
}
