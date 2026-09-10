import type { Metadata } from "next";
import { Inter, Tektur, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { WalletProvider } from "@/lib/WalletContext";
import { ConnectButton } from "@/components/ConnectButton";
import "./globals.css";

// Same typefaces Creditcoin's own site uses: Inter for body copy, Tektur for headings.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const tektur = Tektur({
  variable: "--font-tektur",
  subsets: ["latin"],
  weight: ["500", "600"],
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
      className={`${inter.variable} ${tektur.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <WalletProvider>
          <header className="border-b border-border">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
              <Link href="/" className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground font-display">
                  A
                </span>
                <span className="font-display text-lg font-medium tracking-tight text-ink">Aval</span>
                <span className="hidden text-xs text-muted sm:inline">documentary credit on Creditcoin</span>
              </Link>
              <nav className="flex items-center gap-4 text-sm text-muted sm:gap-6">
                <Link href="/desk" className="hover:text-ink">
                  Desk
                </Link>
                <Link href="/issue" className="hover:text-ink">
                  Issue
                </Link>
                <Link href="/vault" className="hover:text-ink">
                  Lend
                </Link>
                <a
                  href="https://github.com/angelraph/aval"
                  className="hidden hover:text-ink sm:inline"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub
                </a>
                <ConnectButton />
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border">
            <div className="mx-auto max-w-5xl px-5 py-6 text-xs text-muted sm:px-8">
              Built for BUIDL CTC 2026 Fall, on Creditcoin, using the Attestcoin Protocol.
            </div>
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
