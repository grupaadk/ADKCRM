"use client"

import { ReactNode } from "react"
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react"
import { SignInButton } from "@clerk/nextjs"
import { AdminSidebar } from "@/components/AdminSidebar"
import { AdminTopbar } from "@/components/AdminTopbar"
import { SidebarProvider } from "@/components/ui/Sidebar"
import { StatusLabelsProvider } from "@/components/StatusLabelsContext"
import NewLeadAnnouncer from "@/components/NewLeadAnnouncer"

function LoginRedirect() {
  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ background: "var(--background)" }}
    >
      <div className="text-center flex flex-col gap-4 items-center">
        <div
          className="flex size-14 items-center justify-center rounded-xl"
          style={{ background: "var(--panel)", border: "1px solid var(--line)", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}
        >
          <span style={{ fontSize: 24, fontWeight: 800, color: "var(--accent)" }}>A</span>
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-strong)" }}>
            ADK CRM
          </h1>
          <p style={{ marginTop: 4, fontSize: 13, color: "var(--text-mute)" }}>
            Zaloguj się, aby uzyskać dostęp do panelu.
          </p>
        </div>
        <SignInButton mode="modal">
          <button className="btn primary" style={{ padding: "8px 24px", fontSize: 13 }}>
            Zaloguj się
          </button>
        </SignInButton>
      </div>
    </div>
  )
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthLoading>
        <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--background)" }} />
      </AuthLoading>

      <Authenticated>
        <NewLeadAnnouncer />
        <SidebarProvider defaultOpen={false}>
          <AdminSidebar />
          <div className="flex flex-1 flex-col min-h-svh min-w-0">
            <AdminTopbar />
            <StatusLabelsProvider>
              <main
                className="flex-1 overflow-auto"
                style={{ background: "var(--background)", padding: "20px 24px 40px" }}
              >
                {children}
              </main>
            </StatusLabelsProvider>
          </div>
        </SidebarProvider>
      </Authenticated>

      <Unauthenticated>
        <LoginRedirect />
      </Unauthenticated>
    </>
  )
}
