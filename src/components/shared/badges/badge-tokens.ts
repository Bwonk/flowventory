export type BadgeSize = 'sm' | 'md';

export const BADGE_SIZE: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-3 py-1 text-xs',
};

export const BADGE_COLORS = {
  green: {
    bg: 'bg-[#edfce9]',
    text: 'text-[#003c33]',
    dot: 'bg-[#10b981]',
  },
  amber: {
    bg: 'bg-[#fffbeb]',
    text: 'text-[#92400e]',
    dot: 'bg-[#f59e0b]',
  },
  red: {
    bg: 'bg-[#fef2f2]',
    text: 'text-[#b30000]',
    dot: 'bg-[#ef4444]',
  },
  indigo: {
    bg: 'bg-[#eef2ff]',
    text: 'text-[#4338ca]',
    dot: 'bg-[#6366f1]',
  },
  neutral: {
    bg: 'bg-[#f3f4f6]',
    text: 'text-[#374151]',
    dot: 'bg-[#9ca3af]',
  },
  blue: {
    bg: 'bg-[#eff6ff]',
    text: 'text-[#1e40af]',
    dot: 'bg-[#3b82f6]',
  },
} as const;

export type BadgeColor = keyof typeof BADGE_COLORS;

export const BADGE_BASE =
  'inline-flex items-center gap-1.5 rounded-full font-medium border-0';
