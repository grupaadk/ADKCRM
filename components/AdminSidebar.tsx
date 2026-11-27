"use client"

import React, { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { UserMenu } from "@/components/UserMenu"
import { GlobalSearchCommand } from "@/components/GlobalSearchCommand"
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
  Layers,
  LayoutDashboard,
  LayoutGrid,
  UserCog,
  Settings,
  ScrollText,
  Upload,
  PanelLeftClose,
  PanelLeftOpen,
  Calendar,
  CalendarRange,
  Clock,
  CircleDollarSign,
  AlertCircle,
  Truck,
  Kanban,
  Database,
  Search,
  TrendingUp,
  ClipboardList,
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
  { href: "/admin/szanse", label: "Szansa sprzedaży", icon: TrendingUp, alsoActiveFor: ["/admin/szanse", "/admin/szansa"] },
  { href: "/admin/oferta", label: "Oferta", icon: Layers, alsoActiveFor: ["/admin/oferta"] },
  { href: "/admin/panel", label: "Zlecenia", icon: LayoutGrid },
  { href: "/admin/zamowienia", label: "Lista zleceń", icon: ClipboardList },
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, exactMatch: true },
  { href: "/admin/kalendarz", label: "Kalendarz", icon: Calendar },
  { href: "/admin/harmonogram", label: "Harmonogram", icon: CalendarRange },
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
  { href: "/admin/backups", label: "Kopie zapasowe", icon: Database, roles: ["admin"] },
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

type CollapsedTooltipState = {
  id: string
  firstChar?: string
  restText: string
  shortcut?: string
  top: number
  left: number
  active?: boolean
}

function CollapsedSidebarTooltip({ tooltip }: { tooltip: CollapsedTooltipState | null }) {
  if (!tooltip || typeof document === "undefined") return null

  return createPortal(
    <div
      key={tooltip.id}
      role="tooltip"
      style={{
        position: "fixed",
        top: tooltip.top,
        left: tooltip.left,
        transform: "translateY(-50%)",
        zIndex: 60,
        pointerEvents: "none",
      }}
    >
      <div
        className={cx(
          "sidebar-pill-unfold inline-flex h-7 items-center overflow-hidden whitespace-nowrap rounded-md border pl-2 pr-3 text-[12.5px] shadow-lg shadow-black/35",
          tooltip.active
            ? "border-brand/50 bg-slate-900 text-brand"
            : "border-slate-700/90 bg-slate-800 text-slate-100",
        )}
      >
        {tooltip.firstChar !== undefined && (
          <span
            className={cx(
              "font-bold",
              tooltip.active ? "text-brand" : "text-white",
            )}
          >
            {tooltip.firstChar}
          </span>
        )}
        <span className="font-medium">{tooltip.restText}</span>
        {tooltip.shortcut && (
          <kbd className="ml-2 rounded bg-slate-700/90 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
            {tooltip.shortcut}
          </kbd>
        )}
      </div>
    </div>,
    document.body,
  )
}

function NavSection({
  label,
  items,
  pathname,
  counts,
  collapsed,
  onShowTooltip,
  onHideTooltip,
}: {
  label: string
  items: NavItem[]
  pathname: string
  counts?: { clients?: number; templates?: number } | null
  collapsed: boolean
  onShowTooltip: (el: HTMLElement, item: NavItem, active: boolean) => void
  onHideTooltip: () => void
}) {
  return (
    <SidebarGroup className="py-0">
      {!collapsed && (
        <div className="px-3 pb-1 pt-4">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
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
                  title={collapsed ? undefined : item.label}
                  aria-label={item.label}
                  data-active={active}
                  onMouseEnter={(e) => {
                    if (collapsed) onShowTooltip(e.currentTarget, item, active)
                  }}
                  onFocus={(e) => {
                    if (collapsed) onShowTooltip(e.currentTarget, item, active)
                  }}
                  onMouseLeave={onHideTooltip}
                  onBlur={onHideTooltip}
                  onClick={onHideTooltip}
                  className={cx(
                    "group flex items-center rounded-md transition-colors",
                    collapsed
                      ? "justify-center p-1.5"
                      : "justify-between px-2.5 py-[7px] text-[12.5px]",
                    "border-l-2 border-transparent",
                    "text-slate-300 hover:bg-slate-800/80 hover:text-white",
                    "data-[active=true]:border-brand data-[active=true]:bg-brand/15 data-[active=true]:font-medium data-[active=true]:text-brand",
                    focusRing,
                  )}
                >
                  {collapsed ? (
                    <span
                      data-letter-badge="true"
                      aria-hidden="true"
                      className={cx(
                        "flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold leading-none transition-colors",
                        active
                          ? "bg-brand/20 text-brand ring-1 ring-brand/40"
                          : "bg-slate-800 text-slate-300 group-hover:bg-slate-700 group-hover:text-white",
                      )}
                    >
                      {item.label.trim().charAt(0).toLocaleUpperCase("pl-PL")}
                    </span>
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
                              : "bg-slate-800 text-slate-400",
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
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [tooltip, setTooltip] = useState<CollapsedTooltipState | null>(null)

  const hideTooltip = useCallback(() => {
    setTooltip(null)
  }, [])

  const showNavTooltip = useCallback((el: HTMLElement, item: NavItem, active: boolean) => {
    const badgeEl = el.querySelector<HTMLElement>("[data-letter-badge='true']") ?? el
    const rect = badgeEl.getBoundingClientRect()
    const trimmed = item.label.trim()
    const firstChar = trimmed.charAt(0).toLocaleUpperCase("pl-PL")
    const restText = trimmed.slice(1)
    setTooltip({
      id: item.href,
      firstChar,
      restText,
      top: rect.top + rect.height / 2,
      left: rect.left,
      active,
    })
  }, [])

  const showActionTooltip = useCallback((el: HTMLElement, id: string, text: string, shortcut?: string) => {
    const rect = el.getBoundingClientRect()
    setTooltip({
      id,
      restText: text,
      shortcut,
      top: rect.top + rect.height / 2,
      left: rect.right + 8,
    })
  }, [])

  // Listen for global shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsSearchOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const filterByRole = (items: NavItem[]): NavItem[] =>
    items.filter((it) => !it.roles || (me?.role && it.roles.includes(me.role)))

  const visibleMain = filterByRole(mainItems)
  const visibleTools = filterByRole(toolItems)
  const visibleAdmin = filterByRole(adminItems)

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-slate-800 px-3 py-3.5">
        <div className={cx("flex items-center", collapsed ? "justify-center" : "gap-3")}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand shadow-sm">
            <span className="text-[13px] font-bold text-white">A</span>
          </span>
          {!collapsed && (
            <div>
              <span className="block text-[13px] font-semibold text-white">ADK</span>
              <span className="block text-[10.5px] text-slate-400">Panel zarządzania</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="py-1" onScroll={hideTooltip}>
        <div className="px-3 py-2">
          <button
            onClick={() => {
              hideTooltip()
              setIsSearchOpen(true)
            }}
            onMouseEnter={(e) => {
              if (collapsed) showActionTooltip(e.currentTarget, "__search__", "Szukaj...", "⌘K")
            }}
            onFocus={(e) => {
              if (collapsed) showActionTooltip(e.currentTarget, "__search__", "Szukaj...", "⌘K")
            }}
            onMouseLeave={hideTooltip}
            onBlur={hideTooltip}
            className={cx(
              "flex w-full items-center gap-2 rounded-md border border-slate-700/80 bg-slate-800/80 text-slate-400 shadow-sm transition-colors hover:border-brand/70 hover:bg-slate-800 hover:text-slate-100",
              collapsed ? "justify-center px-0 py-1.5" : "px-3 py-1.5 text-sm"
            )}
            title={collapsed ? undefined : "Szukaj (Cmd+K)"}
            aria-label="Szukaj (Cmd+K)"
          >
            <Search className="size-4 shrink-0" />
            {!collapsed && (
              <span className="flex flex-1 items-center justify-between">
                Szukaj...
                <kbd className="hidden rounded bg-slate-700/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-300 sm:inline-block">⌘K</kbd>
              </span>
            )}
          </button>
        </div>

        <NavSection
          label="Główne"
          items={visibleMain}
          pathname={pathname}
          counts={counts}
          collapsed={collapsed}
          onShowTooltip={showNavTooltip}
          onHideTooltip={hideTooltip}
        />
        <NavSection
          label="Narzędzia"
          items={visibleTools}
          pathname={pathname}
          counts={counts}
          collapsed={collapsed}
          onShowTooltip={showNavTooltip}
          onHideTooltip={hideTooltip}
        />
        {visibleAdmin.length > 0 && (
          <NavSection
            label="Administracja"
            items={visibleAdmin}
            pathname={pathname}
            counts={counts}
            collapsed={collapsed}
            onShowTooltip={showNavTooltip}
            onHideTooltip={hideTooltip}
          />
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-800 py-3">
        <div className={cx("flex items-center px-1", collapsed ? "justify-center flex-col gap-3" : "gap-3 justify-between")}>
          {!collapsed && (
            <div className="flex items-center gap-3">
              <UserMenu />
              <span className="text-[12px] text-slate-300">Moje konto</span>
            </div>
          )}
          {collapsed && (
            <UserMenu compact />
          )}
          <button
            onClick={() => {
              hideTooltip()
              toggleSidebar()
            }}
            onMouseEnter={(e) => {
              if (collapsed) showActionTooltip(e.currentTarget, "__toggle__", "Rozwiń nawigację")
            }}
            onFocus={(e) => {
              if (collapsed) showActionTooltip(e.currentTarget, "__toggle__", "Rozwiń nawigację")
            }}
            onMouseLeave={hideTooltip}
            onBlur={hideTooltip}
            title={collapsed ? undefined : "Zwiń nawigację"}
            aria-label={collapsed ? "Rozwiń nawigację" : "Zwiń nawigację"}
            className={cx(
              "flex items-center justify-center rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white",
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
      <CollapsedSidebarTooltip tooltip={collapsed ? tooltip : null} />
      <GlobalSearchCommand isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </Sidebar>
  )
}
