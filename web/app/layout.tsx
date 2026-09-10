import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aval",
  description: "A documentary credit on Creditcoin, settled by the Attestcoin Protocol.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-lg font-semibold tracking-tight text-ink">Aval</span>
              <span className="hidden text-xs text-muted sm:inline">documentary credit on Creditcoin</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted sm:gap-6">
              <a
                href="https://github.com"
                className="hover:text-ink"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border">
          <div className="mx-auto max-w-5xl px-5 py-6 text-xs text-muted sm:px-8">
            Built for BUIDL CTC 2026 Fall, on Creditcoin, using the Attestcoin Protocol.
          </div>
        </footer>
      </body>
    </html>
  );
}
