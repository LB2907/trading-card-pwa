import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SerwistProvider } from "@/components/serwist-provider";
import { AppProviders } from "@/components/app-providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
  themeColor: "#6b4ee6",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body
        className={`${geistSans.className} flex min-h-full flex-col bg-[var(--tc-surface)] antialiased`}
      >
        <SerwistProvider>
          <AppProviders>{children}</AppProviders>
        </SerwistProvider>
      </body>
    </html>
  );
}
