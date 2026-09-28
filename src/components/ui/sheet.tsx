"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "radix-ui"

import { CloseButton } from "@/components/ui/close-button"
import { cn } from "@/lib/utils"

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        // Panelle aynı süre; reduced-motion'da da fade kalır. Şeffaflık
        // azaltılmışsa blur yok, perde koyulaşır.
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:duration-300 data-[state=closed]:duration-200 ease-out fixed inset-0 z-50 bg-black/40 backdrop-blur-sm reduced-transparency:backdrop-blur-none reduced-transparency:bg-black/60",
        className
      )}
      {...props}
    />
  )
}

/**
 * Açık modal katmanın üstündeki bildirimler (sonner) tıklanabilir kalsın:
 * toast'taki "Geri al" dışarı tık sayılıp katmanı kapatmasın.
 */
export function keepOpenOnToast(event: { target: EventTarget | null; preventDefault: () => void }) {
  if (event.target instanceof Element && event.target.closest("[data-sonner-toaster]")) event.preventDefault()
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  onInteractOutside,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        // Çekmece eğrisi (ease-drawer): 300ms giriş, 200ms sessiz çıkış;
        // reduced-motion'da kayma yok, yalnız fade (kayma motion-safe'te).
        // Yüzer katman olduğu için shadow serbest (DESIGN.md elevation kuralı).
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:duration-300 data-[state=closed]:duration-200 ease-drawer motion-reduce:data-[state=open]:fade-in-0 motion-reduce:data-[state=closed]:fade-out-0 fixed z-50 flex flex-col gap-4 shadow-lg",
          // Yüzer panel dili (sidebar hap motifi): kenarlara yapışmaz, kendi
          // radius'u ve hairline çerçevesiyle kanvas üzerinde süzülür.
          side === "right" &&
            "motion-safe:data-[state=closed]:slide-out-to-right motion-safe:data-[state=open]:slide-in-from-right inset-y-2 right-2 w-3/4 rounded-lg border border-hairline sm:max-w-sm",
          side === "left" &&
            "motion-safe:data-[state=closed]:slide-out-to-left motion-safe:data-[state=open]:slide-in-from-left inset-y-2 left-2 w-3/4 rounded-lg border border-hairline sm:max-w-sm",
          side === "top" &&
            "motion-safe:data-[state=closed]:slide-out-to-top motion-safe:data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b border-hairline",
          side === "bottom" &&
            "motion-safe:data-[state=closed]:slide-out-to-bottom motion-safe:data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t border-hairline",
          className
        )}
        onInteractOutside={e => {
          keepOpenOnToast(e)
          onInteractOutside?.(e)
        }}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close asChild>
            <CloseButton
              aria-label="Kapat"
              className="absolute top-3 right-3 size-7 opacity-70 hover:opacity-100"
            />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
}
