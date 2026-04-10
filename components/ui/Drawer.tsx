"use client"

// Tremor Drawer [v0.0.1]

import * as DrawerPrimitives from "@radix-ui/react-dialog"
import { RiCloseLine } from "@remixicon/react"
import * as React from "react"
import { Button } from "./Button"
import { cx, focusRing } from "./utils"

const Drawer = (props: React.ComponentPropsWithoutRef<typeof DrawerPrimitives.Root>) => (
  <DrawerPrimitives.Root {...props} />
)
Drawer.displayName = "Drawer"

const DrawerTrigger = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitives.Trigger>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitives.Trigger>
>(({ className, ...props }, ref) => (
  <DrawerPrimitives.Trigger ref={ref} className={cx(className)} {...props} />
))
DrawerTrigger.displayName = "DrawerTrigger"

const DrawerClose = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitives.Close>
>(({ className, ...props }, ref) => (
  <DrawerPrimitives.Close ref={ref} className={cx(className)} {...props} />
))
DrawerClose.displayName = "DrawerClose"

const DrawerPortal = DrawerPrimitives.Portal
DrawerPortal.displayName = "DrawerPortal"

const DrawerOverlay = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitives.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitives.Overlay>
>(({ className, ...props }, forwardedRef) => (
  <DrawerPrimitives.Overlay
    ref={forwardedRef}
    className={cx("fixed inset-0 z-50 overflow-y-auto bg-black/30", className)}
    {...props}
  />
))
DrawerOverlay.displayName = "DrawerOverlay"

const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitives.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitives.Content>
>(({ className, ...props }, forwardedRef) => (
  <DrawerPortal>
    <DrawerOverlay>
      <DrawerPrimitives.Content
        ref={forwardedRef}
        className={cx(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-y-auto border-r border-gray-200 bg-gray-50 p-0 shadow-lg focus:outline-none",
          focusRing,
          className,
        )}
        {...props}
      />
    </DrawerOverlay>
  </DrawerPortal>
))
DrawerContent.displayName = "DrawerContent"

const DrawerTitle = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitives.Title>
>(({ className, ...props }, forwardedRef) => (
  <DrawerPrimitives.Title
    ref={forwardedRef}
    className={cx("text-base font-semibold text-gray-900", className)}
    {...props}
  />
))
DrawerTitle.displayName = "DrawerTitle"

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
}
