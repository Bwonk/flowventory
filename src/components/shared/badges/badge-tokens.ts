export type BadgeSize = 'sm' | 'md';

export const BADGE_SIZE: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-3 py-1 text-xs',
};

// DESIGN.md ile hizalı semantic renkler. Marka değerleri (pale-green,
// deep-green, error) design token'larından; kalan durum aksanları Tailwind
// paletinden gelir. Arbitrary hex kullanılmaz.
export const BADGE_COLORS = {
  green: {
    bg: 'bg-pale-green', // #edfce9
    text: 'text-deep-green', // #003c33
    dot: 'bg-emerald-500',
  },
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
  },
  red: {
    bg: 'bg-red-50',
    text: 'text-destructive', // #b30000
    dot: 'bg-red-500',
  },
  indigo: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    dot: 'bg-indigo-500',
  },
  neutral: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    dot: 'bg-gray-400',
  },
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    dot: 'bg-blue-500',
  },
} as const;

export type BadgeColor = keyof typeof BADGE_COLORS;

export const BADGE_BASE =
  'inline-flex items-center gap-1.5 rounded-full font-medium border-0';
