import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "ADK App — Mobilna Aplikacja ADK",
  description: "Aplikacja PWA dla użytkowników ADK Okna",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ADK App",
  },
  formatDetection: {
    telephone: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#4dbdc6",
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
        className="min-h-[100dvh] w-full flex flex-col font-sans select-none antialiased bg-slate-50 text-gray-900 overflow-x-hidden font-medium"
      >
        {children}
      </div>
    </StatusLabelsProvider>
  );
}
