"use client"

// Adapted from Tremor/shadcn Sidebar for ADK (Next.js + Tailwind v4)

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
} from "./Drawer"
import { useIsMobile } from "./useMobile"
import { cx, focusRing } from "./utils"
import * as VisuallyHidden from "@radix-ui/react-visually-hidden"
import { RiCloseLine } from "@remixicon/react"
import { PanelLeft } from "lucide-react"
import * as React from "react"
import { Button } from "./Button"

const SIDEBAR_COOKIE_NAME = "sidebar:state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = "16rem"

type SidebarContextType = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextType | null>(null)

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) throw new Error("useSidebar must be used within SidebarProvider.")
  return context
}

export const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    defaultOpen?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }
>(({ defaultOpen = true, open: openProp, onOpenChange: setOpenProp, className, style, children, ...props }, ref) => {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = React.useState(false)
  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? _open

  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value
      if (setOpenProp) {
        setOpenProp(openState)
      } else {
        _setOpen(openState)
      }
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
    },
    [setOpenProp, open],
  )

  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((o) => !o) : setOpen((o) => !o)
  }, [isMobile, setOpen, setOpenMobile])

  const state = open ? "expanded" : "collapsed"

  const contextValue = React.useMemo<SidebarContextType>(
    () => ({ state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar],
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        style={{ "--sidebar-width": SIDEBAR_WIDTH, ...style } as React.CSSProperties}
        className={cx("flex min-h-svh w-full", className)}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
})
SidebarProvider.displayName = "SidebarProvider"

export const Sidebar = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, children, ...props }, ref) => {
    const { isMobile, openMobile, setOpenMobile } = useSidebar()

    if (isMobile) {
      return (
        <Drawer open={openMobile} onOpenChange={setOpenMobile}>
          <DrawerContent className="bg-white p-0 text-gray-900">
            <VisuallyHidden.Root>
              <DrawerTitle>Navigation</DrawerTitle>
            </VisuallyHidden.Root>
            <div className="relative flex h-full w-full flex-col">
              <DrawerClose className="absolute right-4 top-4" asChild>
                <Button variant="ghost" className="!p-2 text-gray-700 hover:text-gray-900">
                  <RiCloseLine className="size-5 shrink-0" aria-hidden="true" />
                </Button>
              </DrawerClose>
              {children}
            </div>
          </DrawerContent>
        </Drawer>
      )
    }

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { state } = useSidebar()
    const collapsed = state === "collapsed"

    return (
      <div
        ref={ref}
        style={{
          width: collapsed ? "52px" : "16rem",
          transition: "width 200ms ease",
          overflow: "hidden",
        }}
        className={cx(
          "hidden md:flex flex-col shrink-0 h-svh sticky top-0",
          "border-r border-gray-200 bg-white",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  },
)
Sidebar.displayName = "Sidebar"

export const SidebarTrigger = React.forwardRef<
  React.ComponentRef<"button">,
  React.ComponentPropsWithRef<"button">
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()
  return (
    <button
      ref={ref}
      className={cx("group inline-flex rounded-md p-1.5 hover:bg-gray-200/50", focusRing)}
      onClick={(event) => { onClick?.(event); toggleSidebar() }}
      {...props}
    >
      <PanelLeft className="size-[18px] shrink-0 text-gray-700" aria-hidden="true" />
      <span className="sr-only">Toggle Sidebar</span>
    </button>
  )
})
SidebarTrigger.displayName = "SidebarTrigger"

export const SidebarFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cx("flex flex-col gap-2 p-3", className)} {...props} />
  ),
)
SidebarFooter.displayName = "SidebarFooter"

export const SidebarContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cx("flex min-h-0 flex-1 flex-col gap-2 overflow-auto", className)} {...props} />
  ),
)
SidebarContent.displayName = "SidebarContent"

export const SidebarHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cx("flex flex-col gap-2 p-2", className)} {...props} />
  ),
)
SidebarHeader.displayName = "SidebarHeader"

export const SidebarGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cx("relative flex w-full min-w-0 flex-col p-3", className)} {...props} />
  ),
)
SidebarGroup.displayName = "SidebarGroup"

export const SidebarGroupContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cx("w-full text-sm", className)} {...props} />
  ),
)
SidebarGroupContent.displayName = "SidebarGroupContent"

export const SidebarMenu = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} className={cx("flex w-full min-w-0 flex-col gap-1", className)} {...props} />
  ),
)
SidebarMenu.displayName = "SidebarMenu"

export const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(
  ({ ...props }, ref) => <li ref={ref} {...props} />,
)
SidebarMenuItem.displayName = "SidebarMenuItem"
