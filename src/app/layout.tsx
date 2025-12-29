import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Navigation from "@/components/layout/Navigation";
import Footer from "@/components/layout/Footer";
import { Providers } from "@/lib/providers/Providers";
import GaPageView from "@/components/analytics/GaPageView";

const notoSansKR = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// Google Analytics ID (dger-api와 동일)
const GA_TRACKING_ID = "G-16WRBHPQXM";

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
  verification: {
    other: {
      "naver-site-verification": "c2e281969f3e71edbeef521689f4847b7f0e593d",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/* Google Analytics */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_TRACKING_ID}', { send_page_view: false });
          `}
        </Script>
      </head>
      <body className={`${notoSansKR.variable} font-sans antialiased`}>
        <Providers>
          <GaPageView />
          <div className="flex flex-col min-h-screen">
            <Navigation />
            <main id="main-content" className="flex-1" role="main">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
