import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { AppProviders } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "投资模拟器",
  description: "前端本地运行的投资模拟器（静态导出）",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppProviders>
          <header className="sticky top-0 z-10 border-b border-black/10 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-black/60">
            <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
              <Link href="/" className="font-semibold tracking-tight">
                投资模拟器
              </Link>
              <nav className="flex items-center gap-4 text-sm">
                <Link
                  className="text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white"
                  href="/trade"
                >
                  交易
                </Link>
                <Link
                  className="text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white"
                  href="/portfolio"
                >
                  资产
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-black/10 py-6 text-center text-xs text-zinc-500 dark:border-white/10">
            纯前端 · 本地模拟数据 · 可静态导出
          </footer>
        </AppProviders>
      </body>
    </html>
  );
}
