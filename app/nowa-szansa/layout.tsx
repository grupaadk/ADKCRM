import { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Grupa ADK — Bezpłatna wycena",
  description: "Wypełnij formularz wyceny stolarki budowlanej i odbierz bezpłatną wycenę dla Twojego domu.",
  icons: {
    icon: "/favicon.jpg",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.jpg",
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
