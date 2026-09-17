import { Bell, Mail, PackagePlus, type LucideIcon } from 'lucide-react';
import { ACTION_CATALOG, type ActionIcon as ActionIconKey } from '@/lib/rules/actions-catalog';
import type { RuleActionType } from '@/lib/rules/types';
import { cn } from '@/lib/utils';

const ICONS: Record<ActionIconKey, LucideIcon> = { bell: Bell, mail: Mail, 'package-plus': PackagePlus };

/** Aksiyon kataloğundaki ikon anahtarını lucide ikonuna çizer. */
export function ActionIcon({ type, className }: { type: RuleActionType; className?: string }) {
  const Icon = ICONS[ACTION_CATALOG[type].icon];
  return <Icon className={cn('size-3.5 text-muted-foreground', className)} aria-hidden />;
}
