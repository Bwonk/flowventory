import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"
import { TextureButton } from "@/components/ui/texture-button"

// Basma geri bildirimi tabanda (DESIGN.md §6: ölçek 0.99'u geçmez) —
// transform geçiş listesinde, reduced-motion'da ölçek yok; uzun basışta
// etiket seçilmez / iOS çağrı balonu açılmaz. `link` ölçeklenmez.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 ease-out active:scale-[0.99] motion-reduce:active:scale-100 select-none [-webkit-touch-callout:none] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline active:scale-100",
        // Araç yolu segmentleri (DESIGN.md §5 "Araç yolu"): bg-muted yol
        // içinde şeffaf segment; yalnız metin rengi değişir.
        segment: "text-muted-foreground hover:text-foreground",
        // Yol içinde öne çıkan ikincil segment — bg-card + hairline hap.
        "segment-card":
          "border border-hairline bg-card text-foreground hover:bg-card",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
        // Yol segmenti: 36px yolun 3px iç boşluğuna oturan 30px yükseklik.
        segment: "h-[30px] gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        "icon-segment": "size-[30px] rounded-md [&_svg:not([class*='size-'])]:size-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// Siyah (default) ve beyaz (outline) butonlar cult-ui TextureButton'dan
// (kullanıcı kararı, 28 Eyl 2026): default → primary, outline → secondary.
// Diğer varyantlar (ghost, link, destructive, segment…) düz kalır.
const TEXTURE_VARIANT = { default: "primary", outline: "secondary" } as const

// Texture'da yükseklik dış katmanda, dolgu/yazı iç yüzeyde yaşar.
const textureOuterSize = cva("", {
  variants: {
    size: {
      default: "h-9",
      xs: "h-6",
      sm: "h-8",
      lg: "h-10",
      icon: "size-9",
      "icon-xs": "size-6",
      "icon-sm": "size-8",
      "icon-lg": "size-10",
      segment: "h-[30px]",
      "icon-segment": "size-[30px]",
    },
  },
  defaultVariants: { size: "default" },
})

const textureInnerSize = cva(
  "gap-2 py-0 font-medium whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      size: {
        default: "px-4 text-sm has-[>svg]:px-3",
        xs: "gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "gap-1.5 px-3 text-sm has-[>svg]:px-2.5",
        lg: "px-6 text-sm has-[>svg]:px-4",
        icon: "px-0",
        "icon-xs": "px-0 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "px-0",
        "icon-lg": "px-0",
        segment: "gap-1.5 px-3 text-sm has-[>svg]:px-2.5",
        "icon-segment": "px-0 [&_svg:not([class*='size-'])]:size-3",
      },
    },
    defaultVariants: { size: "default" },
  }
)

// Çağıranın className'i iki katmana bölünür: dolgu/boşluk/yazı iç yüzeye,
// gerisi (yükseklik, genişlik, yerleşim, kenar, disabled…) dış katmana.
const INNER_CLASS = /^(?:[\w-]+:)*!?(?:p|px|py|pl|pr|pt|pb|gap|text|font|leading|tracking|whitespace|justify)-|^has-\[/

function splitTextureClassName(className?: string): { outer: string; inner: string } {
  const outer: string[] = []
  const inner: string[] = []
  for (const token of (className ?? "").split(/\s+/)) {
    if (!token) continue
    ;(INNER_CLASS.test(token) ? inner : outer).push(token)
  }
  return { outer: outer.join(" "), inner: inner.join(" ") }
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  if (variant === "default" || variant === "outline") {
    const { outer, inner } = splitTextureClassName(className)
    return (
      <TextureButton
        data-slot="button"
        data-variant={variant}
        data-size={size}
        variant={TEXTURE_VARIANT[variant]}
        asChild={asChild}
        className={cn("w-auto touch-manipulation", textureOuterSize({ size }), outer)}
        innerClassName={cn(textureInnerSize({ size }), inner)}
        {...props}
      />
    )
  }

  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
