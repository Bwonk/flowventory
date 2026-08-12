export type BadgeSize = 'sm' | 'md';

export const BADGE_SIZE: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-3 py-1 text-xs',
};

// DESIGN.md ile hizalı semantic renkler. Tüm zeminler/metinler semantic
// token çiftlerinden türer; Tailwind ham paleti ve arbitrary hex kullanılmaz.
export const BADGE_COLORS = {
  green: {
    bg: 'bg-success',
    text: 'text-success-foreground',
    dot: 'bg-status-healthy',
  },
  amber: {
    bg: 'bg-warning',
    text: 'text-warning-foreground',
    dot: 'bg-status-warning',
  },
  red: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    dot: 'bg-status-critical',
  },
  indigo: {
    bg: 'bg-info',
    text: 'text-info-foreground',
    dot: 'bg-accent-blue',
  },
  neutral: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
  blue: {
    bg: 'bg-info',
    text: 'text-info-foreground',
    dot: 'bg-accent-blue',
  },
} as const;

export type BadgeColor = keyof typeof BADGE_COLORS;

export const BADGE_BASE =
  'inline-flex items-center gap-1.5 rounded-full font-medium border-0';
