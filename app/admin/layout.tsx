"use client"

import { ReactNode, useEffect } from "react"
import { Authenticated, Unauthenticated, AuthLoading, useQuery } from "convex/react"
import { useRouter } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { AdminSidebar } from "@/components/AdminSidebar"
import { AdminTopbar } from "@/components/AdminTopbar"
import { SidebarProvider } from "@/components/ui/Sidebar"
import { StatusLabelsProvider } from "@/components/StatusLabelsContext"
import NewLeadAnnouncer from "@/components/NewLeadAnnouncer"

function LoginRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/login")
  }, [router])
  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ background: "var(--background)" }}
    />
  )
}

function AccessGuard({ children }: { children: ReactNode }) {
  const me = useQuery(api.users.me)
  const router = useRouter()
  useEffect(() => {
    if (me === null) {
      router.replace("/brak-dostepu")
    }
  }, [me, router])

  if (me === undefined || me === null) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ background: "var(--background)" }}
      />
    )
  }

  return <>{children}</>
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthLoading>
        <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--background)" }} />
      </AuthLoading>

      <Authenticated>
        <AccessGuard>
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
        </AccessGuard>
      </Authenticated>

      <Unauthenticated>
        <LoginRedirect />
      </Unauthenticated>
    </>
  )
}
