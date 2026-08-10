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

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col font-sans select-none antialiased bg-slate-50 text-gray-900 overflow-x-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
    >
      {children}
    </div>
  );
}
