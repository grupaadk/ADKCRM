"use client"

import { ReactNode } from "react"
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react"
import { SignInButton } from "@clerk/nextjs"
import { AdminHeader } from "@/components/AdminHeader"
import { StatusLabelsProvider } from "@/components/StatusLabelsContext"

function LoginRedirect() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center flex flex-col gap-4 items-center">
        <div className="flex size-14 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
          <span className="text-2xl font-bold text-blue-600">A</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ADK / ALCO CRM</h1>
          <p className="mt-1 text-sm text-gray-500">
            Zaloguj się, aby uzyskać dostęp do panelu.
          </p>
        </div>
        <SignInButton mode="modal">
          <button className="rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
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
        <div className="flex items-center justify-center min-h-screen bg-gray-50" />
      </AuthLoading>
      <Authenticated>
        <div className="flex flex-col min-h-svh">
          <AdminHeader />
          <StatusLabelsProvider>
            <main className="flex-1 p-6 bg-gray-50">{children}</main>
          </StatusLabelsProvider>
        </div>
      </Authenticated>
      <Unauthenticated>
        <LoginRedirect />
      </Unauthenticated>
    </>
  )
}
