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
  title: "CFO - 인테리어 원단 경영관리",
  description: "매출/비용 관리, 전략 시뮬레이션, AI CFO 자문 - 인테리어 원단 제조유통 전용",
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
      <body className="min-h-full flex bg-[var(--color-canvas)]">
        <Sidebar />
        <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
          <Header />
          {/* main padding — viewport 적응 (모바일 4 → 데스크탑 8). tile 페이지는 내부에서 -mx-* 로 escape. */}
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
