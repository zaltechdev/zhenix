import type { Metadata } from "next";
import { Host_Grotesk, Inter } from "next/font/google";
import { cookies } from "next/headers";
import { m } from "@/paraglide/messages.js";
import { getRequestLocale } from "@/lib/i18n/request";
import { HeadControlProvider } from "@/lib/client/vision/head-control-context";
import { PreferenceProvider } from "@/lib/client/preferences/preference-context";
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
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    appleWebApp: {
      title: "Aksa"
    },
    icons: {
      icon: [
        { url: "/icon1.png", type: "image/png" },
        { url: "/icon0.svg", type: "image/svg+xml" }
      ],
      apple: "/apple-icon.png"
    }
  };
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();
  const cookieStore = await cookies();
  const storedTheme = cookieStore.get("aksa-theme")?.value;
  const theme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : undefined;

  return (
    <html data-theme={theme} lang={locale} suppressHydrationWarning>
      <head>
        {/* Blocking script: set data-theme before paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=JSON.parse(localStorage.getItem('aksa-preferences:anonymous')||'null')||{};var t=p.theme||localStorage.getItem('aksa-theme')||(document.cookie.match(/aksa-theme=([^;]+)/)||[])[1];var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var theme=t?t:(d?'dark':'light');var r=document.documentElement;r.dataset.theme=theme;if(p.language==='id'||p.language==='en'){r.lang=p.language;}r.classList.toggle('high-contrast',p.highContrast===true);r.classList.toggle('text-size-large',p.textSize==='large');r.classList.toggle('text-size-extra-large',p.textSize==='extra_large');r.classList.toggle('large-text',p.textSize==='large'||p.textSize==='extra_large');r.classList.toggle('reduce-motion',p.reducedMotion===true);if(t){document.cookie='aksa-theme='+t+'; path=/; max-age=31536000; SameSite=Lax';}}catch(e){}})();`
          }}
        />
      </head>
      <body className={`${hostGrotesk.variable} ${inter.variable} font-body`}>
        <a
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-cloud focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-ink"
          href="#main-content"
        >
          {m.skip_to_content({}, { locale })}
        </a>
        <PreferenceProvider initialLocale={locale}>
          <HeadControlProvider>{children}</HeadControlProvider>
        </PreferenceProvider>
      </body>
    </html>
  );
}
