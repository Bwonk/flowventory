'use client';

import { forwardRef } from 'react';
import { ArchiveBoxArrowDownIcon } from '@/components/ui/icons/archive-box-arrow-down';
import { BellIcon } from '@/components/ui/icons/bell';
import { EnvelopeIcon } from '@/components/ui/icons/envelope';
import type { AnimatedIcon, AnimatedIconHandle } from '@/components/ui/icons/use-icon-hover';
import { ACTION_CATALOG, type ActionIcon as ActionIconKey } from '@/lib/rules/actions-catalog';
import type { RuleActionType } from '@/lib/rules/types';
import { cn } from '@/lib/utils';

const ICONS: Record<ActionIconKey, AnimatedIcon> = { bell: BellIcon, mail: EnvelopeIcon, 'package-plus': ArchiveBoxArrowDownIcon };

/** `[&>svg]`: Button/menü öğesi içindeki `[&_svg]` boyut ve renk kuralları ikonu ezmesin. */
const TONES = {
  muted: 'text-muted-foreground [&>svg]:text-muted-foreground!',
  ink: 'text-foreground [&>svg]:text-foreground!',
} as const;

interface ActionIconProps {
  type: RuleActionType;
  tone?: keyof typeof TONES;
  className?: string;
}

/**
 * Aksiyon kataloğundaki ikon anahtarını animasyonlu heroicons ikonuna çizer.
 * Hover parent'tan sürülür: `useIconHover()` ref'ini buraya bağla (DESIGN.md §6).
 */
export const ActionIcon = forwardRef<AnimatedIconHandle, ActionIconProps>(({ type, tone = 'muted', className }, ref) => {
  const Icon = ICONS[ACTION_CATALOG[type].icon];
  return <Icon ref={ref} size={14} className={cn('flex shrink-0 [&>svg]:size-3.5!', TONES[tone], className)} aria-hidden />;
});
ActionIcon.displayName = 'ActionIcon';
