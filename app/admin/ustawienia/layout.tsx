"use client"

import { ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useEffect } from "react"

interface Props {
  children: ReactNode
}

export default function UstawieniaLayout({ children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const user = useQuery(api.users.me)

  useEffect(() => {
    if (user === undefined) return

    if (!user) {
      router.push("/login")
      return
    }

    const isKontoPage = pathname.includes("/konto")

    if (!isKontoPage && user.role !== "admin") {
      router.push("/brak-dostepu")
    }
  }, [user, pathname, router])

  if (user === undefined) {
    return null
  }

  if (!user) {
    return null
  }

  const isKontoPage = pathname.includes("/konto")
  if (!isKontoPage && user.role !== "admin") {
    return null
  }

  return children
}
