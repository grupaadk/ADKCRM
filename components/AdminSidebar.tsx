"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { UserButton } from "@clerk/nextjs"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/Sidebar"
import { Divider } from "@/components/ui/Divider"
import { cx, focusRing } from "@/components/ui/utils"
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  UserPlus,
  FileText,
  Settings,
} from "lucide-react"

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  countKey?: "clients" | "templates"
  exactMatch?: boolean
}

const navItems: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/zamowienia", label: "Zamówienia", icon: ClipboardList },
  {
    href: "/admin",
    label: "Klienci",
    icon: Users,
    countKey: "clients",
    exactMatch: true,
  },
  { href: "/admin/nowy", label: "Nowy klient", icon: UserPlus },
  { href: "/admin/szablony", label: "Szablony", icon: FileText, countKey: "templates" },
  { href: "/admin/ustawienia", label: "Ustawienia", icon: Settings },
]

function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exactMatch) {
    // Klienci: active on /admin, /admin/klient/...
    return (
      pathname === "/admin" ||
      pathname.startsWith("/admin/klient/")
    )
  }
  return pathname.startsWith(item.href)
}

export function AdminSidebar() {
  const pathname = usePathname()
  const counts = useQuery(api.dashboard.getCounts)

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-gray-200">
            <span className="text-base font-bold text-blue-600">A</span>
          </span>
          <div>
            <span className="block text-sm font-semibold text-gray-900">ADK / ALCO</span>
            <span className="block text-xs text-gray-500">Panel zarządzania</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="pt-0">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navItems.map((item) => {
                const isActive = isNavItemActive(item, pathname)
                const count =
                  item.countKey && counts ? counts[item.countKey] : undefined

                return (
                  <SidebarMenuItem key={item.href}>
                    <Link
                      href={item.href}
                      data-active={isActive}
                      className={cx(
                        "flex items-center justify-between rounded-md p-2 text-sm transition",
                        "text-gray-700 hover:bg-gray-200/50 hover:text-gray-900",
                        "data-[active=true]:bg-blue-50 data-[active=true]:text-blue-600",
                        focusRing,
                      )}
                    >
                      <span className="flex items-center gap-x-2.5">
                        <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
                        {item.label}
                      </span>
                      {count !== undefined && (
                        <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded bg-blue-100 px-1 text-xs font-medium text-blue-600">
                          {count}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <Divider className="py-0" />
        <div className="flex items-center gap-3 px-1 py-1">
          <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
          <span className="text-sm text-gray-600">Moje konto</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
