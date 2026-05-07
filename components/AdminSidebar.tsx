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
import { cx, focusRing } from "@/components/ui/utils"
import {
  ClipboardList,
  Users,
  FileText,
  Settings,
  Receipt,
  ScrollText,
  Upload,
} from "lucide-react"

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  countKey?: "clients" | "templates"
  alsoActiveFor?: string[]
}

const mainItems: NavItem[] = [
  { href: "/admin/zamowienia", label: "Zlecenia", icon: ClipboardList },
  { href: "/admin/klienci", label: "Klienci", icon: Users, countKey: "clients", alsoActiveFor: ["/admin/klient/"] },
  { href: "/admin/faktury", label: "Faktury", icon: Receipt },
]

const toolItems: NavItem[] = [
  { href: "/admin/szablony", label: "Szablony", icon: FileText, countKey: "templates" },
  { href: "/admin/dokumenty", label: "Dokumenty", icon: Upload },
]

const adminItems: NavItem[] = [
  { href: "/admin/ustawienia", label: "Ustawienia", icon: Settings },
  { href: "/admin/logi", label: "Logi systemu", icon: ScrollText },
]

function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (pathname.startsWith(item.href)) return true
  return item.alsoActiveFor?.some((prefix) => pathname.startsWith(prefix)) ?? false
}

function NavSection({
  label,
  items,
  pathname,
  counts,
}: {
  label: string
  items: NavItem[]
  pathname: string
  counts?: { clients?: number; templates?: number } | null
}) {
  return (
    <SidebarGroup className="py-0">
      <div className="px-3 pb-1 pt-4">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          {label}
        </span>
      </div>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {items.map((item) => {
            const active = isNavItemActive(item, pathname)
            const count = item.countKey && counts ? counts[item.countKey] : undefined
            return (
              <SidebarMenuItem key={item.href}>
                <Link
                  href={item.href}
                  data-active={active}
                  className={cx(
                    "flex items-center justify-between rounded-md px-2.5 py-[7px] text-[12.5px] transition-colors",
                    "border-l-2 border-transparent",
                    "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900",
                    "data-[active=true]:border-brand data-[active=true]:bg-[var(--accent-soft)] data-[active=true]:font-medium data-[active=true]:text-brand",
                    focusRing,
                  )}
                >
                  <span className="flex items-center gap-x-2.5">
                    <item.icon className="size-[15px] shrink-0" aria-hidden="true" />
                    {item.label}
                  </span>
                  {count !== undefined && (
                    <span
                      className={cx(
                        "inline-flex min-w-[1.25rem] items-center justify-center rounded px-1.5 text-[10px] font-semibold",
                        active
                          ? "bg-brand text-white"
                          : "bg-gray-100 text-gray-500",
                      )}
                    >
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
  )
}

export function AdminSidebar() {
  const pathname = usePathname()
  const counts = useQuery(api.dashboard.getCounts)

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-gray-200 px-3 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand shadow-sm">
            <span className="text-[13px] font-bold text-white">A</span>
          </span>
          <div>
            <span className="block text-[13px] font-semibold text-gray-900">ADK</span>
            <span className="block text-[10.5px] text-gray-500">Panel zarządzania</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="py-1">
        <NavSection label="Główne" items={mainItems} pathname={pathname} counts={counts} />
        <NavSection label="Narzędzia" items={toolItems} pathname={pathname} counts={counts} />
        <NavSection label="Administracja" items={adminItems} pathname={pathname} counts={counts} />
      </SidebarContent>

      <SidebarFooter className="border-t border-gray-200 py-3">
        <div className="flex items-center gap-3 px-1">
          <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
          <span className="text-[12px] text-gray-600">Moje konto</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
