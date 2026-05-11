import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DIAVIS — Dian's Very Intelligent System",
  description: "디안 CFO 통합 경영 시스템 — 결을 만드는 사람을 위한 AI 동반자",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex bg-white">
        <Sidebar />
        <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
          <Header />
          {/* main padding — viewport 적응. hero/풀-블리드 페이지는 내부에서 -mx-* 로 escape. */}
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
