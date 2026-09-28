"use client";

/**
 * cult-ui `texture-button` — upstream: github.com/nolly-studio/cult-ui
 * (apps/www/registry/default/ui/texture-button.tsx). `shadcn add
 * https://cult-ui.com/r/texture-button.json` cult-ui.com'un bot duvarı (429)
 * yüzünden çalışmadığından GitHub raw'dan alındı. Yapı ve API upstream'le
 * aynı (dış gradyan kenar + iç yüzey, variant/size/asChild); DESIGN.md'ye
 * çevrilenler: renkler token'dan (siyah → `primary` ink, beyaz → `card`/`muted`,
 * indigo accent → `accent-blue`), `dark:` yok (light-only), köşeler buton
 * ölçeği (dış `rounded-md` 6 = iç 5 + 1px kenar, konsantrik), `transition`
 * yerine renk/opaklık/transform listesi, ink odak halkası + basma geri
 * bildirimi + disabled eklendi. İki ek: `innerClassName` (iç yüzeye sınıf) ve
 * `asChild`'da iç yüzeyin çocuğun (ör. Link) İÇİNE sarılması — upstream
 * Slot'u iç div'e uyguluyordu, Link kayboluyordu.
 */

import { cva } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariantsOuter = cva(
  "inline-flex shrink-0 select-none [-webkit-touch-callout:none] outline-none transition-[opacity,transform,border-color] duration-150 ease-out active:scale-[0.99] motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "w-full border border-primary/10 bg-gradient-to-b from-primary/70 to-primary p-px",
        accent:
          "w-full border border-primary/10 bg-gradient-to-b from-accent-blue/60 to-accent-blue p-px",
        destructive:
          "w-full border border-primary/10 bg-gradient-to-b from-destructive/60 to-destructive p-px",
        secondary: "w-full border border-foreground/15 bg-card/50 p-px",
        minimal:
          "group/texture-button w-full border border-foreground/15 bg-card/50 p-px hover:bg-gradient-to-t hover:from-muted active:bg-muted",
        icon: "group/texture-button rounded-full border border-foreground/10 bg-card/50 p-px hover:bg-gradient-to-t hover:from-muted active:bg-muted",
      },
      size: {
        sm: "rounded-md",
        default: "rounded-md",
        lg: "rounded-lg",
        icon: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

const innerDivVariants = cva(
  "text-muted-foreground flex h-full w-full items-center justify-center transition-[color,background-color] duration-150 ease-out",
  {
    variants: {
      variant: {
        primary:
          "gap-2 bg-gradient-to-b from-primary/85 to-primary text-sm text-primary-foreground hover:from-primary/75 hover:to-primary/90 active:from-primary active:to-primary",
        accent:
          "gap-2 bg-gradient-to-b from-accent-blue/85 to-accent-blue text-sm text-primary-foreground hover:from-accent-blue/75 hover:to-accent-blue/90",
        destructive:
          "gap-2 bg-gradient-to-b from-destructive/80 to-destructive text-sm text-primary-foreground hover:from-destructive/70 hover:to-destructive/90",
        secondary:
          "gap-2 bg-gradient-to-b from-card to-muted/70 text-sm text-foreground hover:from-muted/40 hover:to-muted active:from-muted/60 active:to-muted",
        minimal:
          "bg-gradient-to-b from-card to-muted/40 text-sm text-foreground group-hover/texture-button:from-muted/40 group-hover/texture-button:to-muted/60 group-active/texture-button:from-muted/60 group-active/texture-button:to-muted",
        icon: "rounded-full bg-gradient-to-b from-card to-muted/40 text-foreground group-active/texture-button:bg-muted",
      },
      size: {
        sm: "rounded-[5px] px-3 py-1 text-xs",
        default: "rounded-[5px] px-4 py-2 text-sm",
        lg: "rounded-[7px] px-4 py-2 text-base",
        icon: "rounded-full p-1",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface UnifiedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "accent"
    | "destructive"
    | "minimal"
    | "icon";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
  /** İç yüzeye eklenecek sınıflar (dolgu, yazı, boşluk). */
  innerClassName?: string;
}

const TextureButton = React.forwardRef<HTMLButtonElement, UnifiedButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "default",
      asChild = false,
      className,
      innerClassName,
      ...props
    },
    ref
  ) => {
    const outerClassName = cn(buttonVariantsOuter({ variant, size }), className);
    const innerClass = cn(innerDivVariants({ variant, size }), innerClassName);

    // asChild: dış katman çocuğun kendisi (ör. Link) olur; iç yüzey onun
    // çocuklarını sarar. Yüzey `span` — button/a içinde div geçersiz.
    if (asChild && React.isValidElement<{ children?: React.ReactNode }>(children)) {
      return (
        <Slot.Root className={outerClassName} ref={ref} {...props}>
          {React.cloneElement(
            children,
            undefined,
            <span className={innerClass}>{children.props.children}</span>
          )}
        </Slot.Root>
      );
    }

    return (
      <button className={outerClassName} ref={ref} {...props}>
        <span className={innerClass}>{children}</span>
      </button>
    );
  }
);

TextureButton.displayName = "TextureButton";

export { TextureButton };
