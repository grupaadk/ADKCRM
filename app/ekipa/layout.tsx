import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "ADK Ekipy — Mobilny Kalendarz Ekipy",
  description: "Dedykowana aplikacja PWA dla ekip montażowych ADK Okna",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ADK Ekipy",
  },
  formatDetection: {
    telephone: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#f6f7f9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function EkipaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className="min-h-[100dvh] flex flex-col font-sans select-none antialiased overflow-x-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      {children}
    </div>
  );
}
