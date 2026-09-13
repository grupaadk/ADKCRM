import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Ekipa — Mobilny Kalendarz Montażysty",
  description: "Dedykowana aplikacja PWA dla ekip montażowych Grupa ADK",
  manifest: "/manifest-ekipa.json",
  icons: {
    icon: "/icon-ekipa-192.png",
    apple: "/icon-ekipa-512.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ekipa",
  },
  formatDetection: {
    telephone: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
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
