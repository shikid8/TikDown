// ─── Root Layout ──────────────────────────────────────────────────────────────
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TikTok Downloader — Download Video Tanpa Watermark",
  description:
    "Download video TikTok dengan kualitas HD, tanpa watermark. Gunakan cookies TikTok Anda untuk mengakses video private dan konten eksklusif.",
  keywords: ["tiktok downloader", "download video tiktok", "tanpa watermark", "tiktok no watermark"],
  authors: [{ name: "TikTok Downloader" }],
  robots: "index, follow",
  openGraph: {
    title: "TikTok Downloader",
    description: "Download video TikTok HD tanpa watermark",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-slate-950 text-slate-100 min-h-screen`}
      >
        {children}
        <Toaster
          position="top-right"
          theme="dark"
          richColors
          toastOptions={{
            style: {
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid rgba(6, 182, 212, 0.2)",
              backdropFilter: "blur(12px)",
            },
          }}
        />
      </body>
    </html>
  );
}
