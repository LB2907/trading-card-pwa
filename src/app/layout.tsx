import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/700.css";
import "./globals.css";
import { SerwistProvider } from "@/components/serwist-provider";
import { AppProviders } from "@/components/app-providers";

const APP = "Trading Card Studio";

export const metadata: Metadata = {
  applicationName: APP,
  title: { default: APP, template: `%s · ${APP}` },
  description:
    "PWA: build trading cards from your media locally. Optional cloud sign-in and backup when Supabase is configured.",
  appleWebApp: { capable: true, title: APP, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0c0a09",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full`}
    >
      <body
        className={`${GeistSans.className} flex min-h-full flex-col bg-[var(--tc-surface)] antialiased`}
      >
        <SerwistProvider>
          <AppProviders>{children}</AppProviders>
        </SerwistProvider>
      </body>
    </html>
  );
}
