import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Biuro — Mobilna Aplikacja ADK",
  description: "Aplikacja biurowa PWA dla użytkowników ADK Okna",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-biuro-192.png",
    apple: "/icon-biuro-512.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Biuro",
  },
  formatDetection: {
    telephone: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#4abbc3",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

import { StatusLabelsProvider } from "@/components/StatusLabelsContext";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <StatusLabelsProvider>
      <div
        className="h-[100dvh] w-full flex flex-col font-sans select-none antialiased bg-slate-50 text-gray-900 overflow-hidden font-medium"
      >
        {children}
      </div>
    </StatusLabelsProvider>
  );
}
