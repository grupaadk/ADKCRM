import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "ADK Ekipy — Mobilny Kalendarz Ekipy",
  description: "Dedykowana aplikacja PWA dla ekip montażowych ADK Okna",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ADK Ekipy",
  },
  formatDetection: {
    telephone: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function EkipaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans select-none antialiased">
      {children}
    </div>
  );
}
