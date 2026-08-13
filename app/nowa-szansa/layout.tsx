import { Metadata } from "next";

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
  return <>{children}</>;
}
