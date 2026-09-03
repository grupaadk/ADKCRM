"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { UserMenu } from "@/components/UserMenu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/Sidebar"
import { cx, focusRing } from "@/components/ui/utils"
import {
  LayoutDashboard,
  LayoutGrid,
  UserCog,
  Settings,
  Receipt,
  ScrollText,
  Upload,
  PanelLeftClose,
  PanelLeftOpen,
  Calendar,
  Clock,
  CircleDollarSign,
  AlertCircle,
  Truck,
  Kanban,
} from "lucide-react"

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  countKey?: "clients" | "templates"
  alsoActiveFor?: string[]
  /** Only highlight when pathname equals href exactly */
  exactMatch?: boolean
  /** Hide unless current user has one of these roles */
  roles?: Array<"admin" | "sales" | "montaz">
}

const mainItems: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, exactMatch: true },
  { href: "/admin/panel", label: "Panel", icon: LayoutGrid },
  { href: "/admin/kalendarz", label: "Kalendarz", icon: Calendar },
  { href: "/admin/reklamacje", label: "Reklamacje", icon: AlertCircle },
  { href: "/admin/zamowienia-dostawcy", label: "Dostawcy", icon: Truck },
  { href: "/admin/hr", label: "HR (Urlopy, Ekipy, Flota)", icon: Clock, alsoActiveFor: ["/admin/hr/", "/admin/ekipy/", "/admin/flota/"] },
  { href: "/admin/finanse", label: "Finanse", icon: CircleDollarSign, alsoActiveFor: ["/admin/finanse", "/admin/faktury", "/admin/wydatki"], roles: ["admin"] },
]

const toolItems: NavItem[] = [
  { href: "/admin/dokumenty", label: "Dokumenty", icon: Upload },
]

const adminItems: NavItem[] = [
  { href: "/admin/ustawienia", label: "Ustawienia", icon: Settings, exactMatch: true, roles: ["admin"] },
  { href: "/admin/ustawienia/uzytkownicy", label: "Użytkownicy", icon: UserCog, roles: ["admin"] },
  { href: "/admin/praca-it", label: "Praca IT", icon: Kanban, roles: ["admin"] },
  { href: "/admin/logi", label: "Logi systemu", icon: ScrollText, roles: ["admin"] },
]

function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exactMatch) {
    if (pathname === item.href) return true
  } else if (pathname.startsWith(item.href)) {
    return true
  }
  return item.alsoActiveFor?.some((prefix) => pathname.startsWith(prefix)) ?? false
}

function NavSection({
  label,
  items,
  pathname,
  counts,
  collapsed,
}: {
  label: string
  items: NavItem[]
  pathname: string
  counts?: { clients?: number; templates?: number } | null
  collapsed: boolean
}) {
  return (
    <SidebarGroup className="py-0">
      {!collapsed && (
        <div className="px-3 pb-1 pt-4">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            {label}
          </span>
        </div>
      )}
      {collapsed && <div className="pt-3" />}
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {items.map((item) => {
            const active = isNavItemActive(item, pathname)
            const count = item.countKey && counts ? counts[item.countKey] : undefined
            return (
              <SidebarMenuItem key={item.href}>
                <Link
                  href={item.href}
                  title={item.label}
                  data-active={active}
                  className={cx(
                    "flex items-center rounded-md transition-colors",
                    collapsed
                      ? "justify-center p-2.5"
                      : "justify-between px-2.5 py-[7px] text-[12.5px]",
                    "border-l-2 border-transparent",
                    "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900",
                    "data-[active=true]:border-brand data-[active=true]:bg-[var(--accent-soft)] data-[active=true]:font-medium data-[active=true]:text-brand",
                    focusRing,
                  )}
                >
                  {collapsed ? (
                    <item.icon className="size-[16px] shrink-0" aria-hidden="true" />
                  ) : (
                    <>
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
                    </>
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
  const me = useQuery(api.users.me)
  const { state, toggleSidebar } = useSidebar()
  const collapsed = state === "collapsed"

  const filterByRole = (items: NavItem[]): NavItem[] =>
    items.filter((it) => !it.roles || (me?.role && it.roles.includes(me.role)))

  const visibleMain = filterByRole(mainItems)
  const visibleTools = filterByRole(toolItems)
  const visibleAdmin = filterByRole(adminItems)

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-gray-200 px-3 py-3.5">
        <div className={cx("flex items-center", collapsed ? "justify-center" : "gap-3")}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand shadow-sm">
            <span className="text-[13px] font-bold text-white">A</span>
          </span>
          {!collapsed && (
            <div>
              <span className="block text-[13px] font-semibold text-gray-900">ADK</span>
              <span className="block text-[10.5px] text-gray-500">Panel zarządzania</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="py-1">
        <NavSection label="Główne" items={visibleMain} pathname={pathname} counts={counts} collapsed={collapsed} />
        <NavSection label="Narzędzia" items={visibleTools} pathname={pathname} counts={counts} collapsed={collapsed} />
        {visibleAdmin.length > 0 && (
          <NavSection label="Administracja" items={visibleAdmin} pathname={pathname} counts={counts} collapsed={collapsed} />
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-gray-200 py-3">
        <div className={cx("flex items-center px-1", collapsed ? "justify-center flex-col gap-3" : "gap-3 justify-between")}>
          {!collapsed && (
            <div className="flex items-center gap-3">
              <UserMenu />
              <span className="text-[12px] text-gray-600">Moje konto</span>
            </div>
          )}
          {collapsed && (
            <UserMenu compact />
          )}
          <button
            onClick={toggleSidebar}
            title={collapsed ? "Rozwiń nawigację" : "Zwiń nawigację"}
            className={cx(
              "flex items-center justify-center rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900",
              focusRing,
            )}
          >
            {collapsed
              ? <PanelLeftOpen className="size-[15px]" />
              : <PanelLeftClose className="size-[15px]" />
            }
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
