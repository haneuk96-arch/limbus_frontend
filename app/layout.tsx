import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const GA_MEASUREMENT_ID = "G-9XX97XQY1L";
import ConditionalHeader from "@/components/ConditionalHeader";
import ConditionalFooter from "@/components/ConditionalFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://limbus.haneuk.info"),
  title: {
    default: "단테의 달의기억 | 림버스 에고기프트/던전 정보",
    template: "%s | 단테의 달의기억",
  },
  description:
    "림버스 컴퍼니 에고기프트, 던전 이벤트, 키워드, 조합식 정보를 빠르게 확인할 수 있는 팬사이트입니다. 단딸기 키워드 및 공유 보고서 기능을 제공합니다.",
  keywords: [
    "Limbus Company",
    "림버스 컴퍼니",
    "림버스 에고기프트",
    "에고기프트",
    "단딸기",
    "던전 이벤트",
    "카드팩",
    "키워드",
    "조합식",
  ],
  authors: [{ name: "단테의 달의기억" }],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "단테의 달의기억",
    title: "단테의 달의기억 | 림버스 에고기프트/던전 정보",
    description:
      "림버스 컴퍼니 에고기프트, 던전 이벤트, 키워드, 조합식 정보를 빠르게 확인할 수 있는 팬사이트입니다.",
    url: "https://limbus.haneuk.info",
  },
  twitter: {
    card: "summary_large_image",
    title: "단테의 달의기억 | 림버스 에고기프트/던전 정보",
    description: "림버스 컴퍼니 에고기프트/던전 이벤트/키워드 정보",
  },
  icons: {
    icon: "/LunarMemory.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-N6JK9BT9');`,
          }}
        />
        {/* End Google Tag Manager */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
        suppressHydrationWarning
      >
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-N6JK9BT9"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics-gtag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <ConditionalHeader />
        <main className="flex-1">
          {children}
        </main>
        <ConditionalFooter />
      </body>
    </html>
  );
}
