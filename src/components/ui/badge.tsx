import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Data-ink badge — uygulamadaki TEK rozet renk kaynağı (DESIGN.md §5).
 * shared/badges/* sarmalayıcıları yalnızca domain→variant eşler; kendi renk
 * haritası tutmaz. Renkler semantic token çiftlerinden; ham palet yasak.
 */
const badgeVariants = cva('inline-flex items-center gap-1.5 rounded-full border font-medium', {
  variants: {
    variant: {
      neutral: 'border-transparent bg-muted text-muted-foreground',
      success: 'border-transparent bg-success text-success-foreground',
      warning: 'border-transparent bg-warning text-warning-foreground',
      critical: 'border-transparent bg-critical text-critical-foreground',
      info: 'border-transparent bg-info text-info-foreground',
      outline: 'border-hairline text-foreground',
    },
    size: {
      sm: 'px-2 py-0.5 text-[11px]',
      md: 'px-3 py-1 text-xs',
    },
  },
  defaultVariants: {
    variant: 'neutral',
    size: 'sm',
  },
});

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;
export type BadgeSize = NonNullable<VariantProps<typeof badgeVariants>['size']>;

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

/** span render eder: rozet inline bir öğedir, <p>/<td> içine güvenle girer. */
function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
