import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/layout/Navigation";
import { Providers } from "@/lib/providers/Providers";

const notoSansKR = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "DGER | 중증응급질환 대시보드",
  description: "중증응급질환 진료 현황 및 병상 정보 대시보드",
  keywords: ["응급의료", "중증응급질환", "병상현황", "응급실"],
  authors: [{ name: "DGER Team" }],
  openGraph: {
    title: "DGER | 중증응급질환 대시보드",
    description: "중증응급질환 진료 현황 및 병상 정보 대시보드",
    type: "website",
    locale: "ko_KR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark">
      <body className={`${notoSansKR.variable} font-sans antialiased`}>
        <Providers>
          <Navigation />
          <main id="main-content" className="min-h-[calc(100vh-56px)]" role="main">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
