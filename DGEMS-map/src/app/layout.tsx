import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/layout/Navigation";

const notoSansKR = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "DGER | 중증응급질환 대시보드",
  description: "중증응급질환 진료 현황 및 병상 정보 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${notoSansKR.variable} font-sans antialiased`}>
        <Navigation />
        <main className="min-h-[calc(100vh-56px)]">
          {children}
        </main>
      </body>
    </html>
  );
}
