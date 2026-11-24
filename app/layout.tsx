import type { Metadata } from "next";
import Link from "next/link";
import { Libre_Caslon_Text, Libre_Franklin } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { AEVUM_CHAIN_ID, EXPLORER_URL, POOL_ADDRESS } from "@/lib/config";
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

const TITLE = "Pactora: pre-orders that only charge when the batch is real";
// Under 160 characters on purpose (search and share previews cut longer text).
const DESCRIPTION =
  "Pre-orders for small makers: buyers only sign, payment is collected in one transaction when enough orders arrive, and nothing moves if not.";

const REPO_URL = "https://github.com/mericcintosun/pactora";

export const metadata: Metadata = {
  title: { default: TITLE, template: "%s | Pactora" },
  description: DESCRIPTION,
  // The farm's tracked demo URL; NEXT_PUBLIC_SITE_URL overrides it.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://pactora-smoky.vercel.app"),
  // The image itself is served by app/opengraph-image.tsx (1200x630), which Next attaches to openGraph and twitter.
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "Pactora" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
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
            <div className="flex flex-wrap gap-x-5 font-semibold">
              <Link href="/pledge" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">Campaigns</Link>
              <Link href="/how" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">Contract and method</Link>
            </div>
          </div>
          <section aria-labelledby="footer-security" className="border-t-2 border-foreground">
            <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-6 text-sm md:grid-cols-12">
              <h2 id="footer-security" className="text-lg font-bold md:col-span-3">
                About and security
              </h2>
              <dl className="grid grid-cols-1 gap-2 md:col-span-9">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest">Contract</dt>
                  <dd className="break-all">
                    {POOL_ADDRESS ? (
                      <a
                        href={`${EXPLORER_URL}/address/${POOL_ADDRESS}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={POOL_ADDRESS}
                        className="underline underline-offset-2"
                      >
                        QuorumPool {POOL_ADDRESS}
                      </a>
                    ) : (
                      "Practice mode: no contract connected"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest">Network</dt>
                  <dd>Aevum testnet, chain id {AEVUM_CHAIN_ID}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest">Source</dt>
                  <dd className="flex flex-wrap gap-x-5">
                    <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-2">
                      GitHub repository
                    </a>
                    <a
                      href={`${REPO_URL}/blob/main/SECURITY.md`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center underline underline-offset-2"
                    >
                      SECURITY.md: wallet permissions and limits
                    </a>
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        </footer>
      </body>
    </html>
  );
}
