import type { Metadata } from "next";
import { Host_Grotesk, Inter } from "next/font/google";
import { m } from "@/paraglide/messages.js";
import { getRequestLocale } from "@/lib/i18n/request";
import "./globals.css";

const hostGrotesk = Host_Grotesk({
  variable: "--font-host-grotesk",
  subsets: ["latin"]
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"]
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();

  return {
    title: m.metadata_title({}, { locale }),
    description: m.metadata_description({}, { locale }),
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
  };
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${hostGrotesk.variable} ${inter.variable} font-body`}>
        <a
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-cloud focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-ink"
          href="#main-content"
        >
          {m.skip_to_content({}, { locale })}
        </a>
        {children}
      </body>
    </html>
  );
}
