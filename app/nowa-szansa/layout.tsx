import { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "ADK Okna — Bezpłatna wycena",
  description: "Wypełnij formularz wyceny stolarki budowlanej i odbierz bezpłatną wycenę dla Twojego domu.",
  icons: {
    icon: "https://assets.cdn.prod.website-files.com/69b07f0b2f3857e59bf8f5e2/69b2de5061abfa0788a604f7_fav.jpg",
    apple: "https://assets.cdn.prod.website-files.com/69b07f0b2f3857e59bf8f5e2/69b2de55cee3491b507f87ae_webclip.jpg",
  },
};

export default function NowaSzansaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-L4NHZY2BKN"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', 'G-L4NHZY2BKN');
        `}
      </Script>
      {children}
    </>
  );
}
