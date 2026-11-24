import type { Metadata } from "next";
import Link from "next/link";
import { Libre_Caslon_Text, Libre_Franklin } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const caslon = Libre_Caslon_Text({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-caslon",
});

const franklin = Libre_Franklin({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-franklin",
});

export const metadata: Metadata = {
  title: { default: "Pactora: pre-orders that only charge when the batch is real", template: "%s · Pactora" },
  description:
    "Pre-orders for small makers. Buyers only sign. When enough orders arrive, every payment is collected in one transaction; if not, nobody's money ever moves. tUSD8 on Aevum testnet.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://pactora.vercel.app"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${caslon.variable} ${franklin.variable}`}>
      <body className="min-h-screen antialiased">
        <SiteHeader />
        <main>{children}</main>
        <footer className="mt-24 border-t-2 border-foreground">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[65ch]">
              Pactora runs on Aevum testnet with test tUSD8 only. Built for the Aevum Builder Challenge #1.
            </p>
            <div className="flex gap-5 font-semibold">
              <Link href="/pledge" className="underline-offset-4 hover:underline">Campaigns</Link>
              <Link href="/how" className="underline-offset-4 hover:underline">Contract and method</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
