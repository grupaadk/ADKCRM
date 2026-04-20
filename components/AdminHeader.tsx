"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { UserButton } from "@clerk/nextjs"
import { cx, focusRing } from "@/components/ui/utils"
import {
  ClipboardList,
  Users,
  Settings,
  Mail,
} from "lucide-react"

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  countKey?: "clients"
  exactMatch?: boolean
}

const navItems: NavItem[] = [
  { href: "/admin/mail", label: "Mail", icon: Mail },
  { href: "/admin/zamowienia", label: "Zlecenia", icon: ClipboardList },
  {
    href: "/admin",
    label: "Klienci",
    icon: Users,
    countKey: "clients",
    exactMatch: true,
  },
  { href: "/admin/ustawienia", label: "Ustawienia", icon: Settings },
]

function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exactMatch) {
    return pathname === "/admin" || pathname.startsWith("/admin/klient/")
  }
  return pathname.startsWith(item.href)
}

export function AdminHeader() {
  const pathname = usePathname()
  const counts = useQuery(api.dashboard.getCounts)

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white">
      <div className="flex h-14 items-center gap-6 px-6">
        {/* Logo */}
        <Link href="/admin" className="flex items-center gap-2.5 shrink-0">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-gray-200">
            <span className="text-sm font-bold text-blue-600">A</span>
          </span>
          <span className="text-sm font-semibold text-gray-900 hidden sm:block">ADK</span>
        </Link>

        {/* Nav */}
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = isNavItemActive(item, pathname)
            const count = item.countKey && counts ? counts[item.countKey] : undefined

            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={isActive}
                className={cx(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition",
                  "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                  "data-[active=true]:bg-blue-50 data-[active=true]:text-blue-600",
                  focusRing,
                )}
              >
                <item.icon className="size-[15px] shrink-0" aria-hidden="true" />
                {item.label}
                {count !== undefined && (
                  <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded bg-blue-100 px-1 text-xs font-medium text-blue-600">
                    {count}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="flex items-center gap-2 shrink-0">
          <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
        </div>
      </div>
    </header>
  )
}
