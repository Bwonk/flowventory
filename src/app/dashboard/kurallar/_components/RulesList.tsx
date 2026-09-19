'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import type { TrackingRuleItem } from '@/app/api/rules/route';
import { Table, type TableColumn } from '@/components/motion/table';
import { EmptyState } from '@/components/shared/data-table/EmptyState';
import { TableFooterNote } from '@/components/shared/data-table/TableFooterNote';
import { TableSection } from '@/components/shared/data-table/TableSection';
import { PencilIcon } from '@/components/ui/icons/pencil';
import { TrashIcon } from '@/components/ui/icons/trash';
import type { AnimatedIconHandle } from '@/components/ui/icons/use-icon-hover';
import { Switch } from '@/components/ui/switch';
import type { RuleActionType } from '@/lib/rules/types';
import { ActionIcon } from './ActionIcon';
import { DeleteRuleDialog } from './DeleteRuleDialog';

const relativeFormatter = new Intl.RelativeTimeFormat('tr-TR', { numeric: 'auto' });

export function relativeTime(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const hours = Math.round(diffMs / (60 * 60 * 1000));
  if (Math.abs(hours) < 24) return relativeFormatter.format(hours, 'hour');
  return relativeFormatter.format(Math.round(hours / 24), 'day');
}

interface RulesListProps {
  rules: TrackingRuleItem[];
  loading: boolean;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => Promise<boolean>;
  onCreateFirst: () => void;
}

/**
 * Kural listesi — DESIGN.md "Liste kalıbı": TableSection + motion Table,
 * satır menüsünde düzenle/sil, etkin anahtarı kolon olarak. Satıra tıklamak
 * düzenlemeye gider.
 */
export function RulesList({ rules, loading, onToggle, onDelete, onCreateFirst }: RulesListProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<TrackingRuleItem | null>(null);

  const columns = useMemo<TableColumn<TrackingRuleItem>[]>(
    () => [
      {
        key: 'name',
        header: 'Kural',
        minWidth: 280,
        cell: rule => (
          <div className="min-w-0">
            <Link
              href={`/dashboard/kurallar/${rule.id}`}
              className="block truncate font-medium text-foreground hover:underline underline-offset-4"
              onClick={e => e.stopPropagation()}
            >
              {rule.name}
            </Link>
            <p className="truncate text-xs text-muted-foreground" title={rule.sentence}>
              {rule.sentence}
            </p>
          </div>
        ),
      },
      {
        key: 'actions',
        header: 'Aksiyonlar',
        width: '220px',
        cell: rule => (
          <ActionSummary types={rule.actionTypes} summary={rule.actionSummary} />
        ),
      },
      {
        key: 'lastTriggeredAt',
        header: 'Son tetik',
        width: '128px',
        cell: rule => (
          <span className="text-sm text-muted-foreground">{rule.lastTriggeredAt ? relativeTime(rule.lastTriggeredAt) : '—'}</span>
        ),
      },
      {
        key: 'enabled',
        header: 'Etkin',
        align: 'center',
        width: '72px',
        printHidden: true,
        cell: rule => (
          <span onClick={e => e.stopPropagation()}>
            <Switch
              checked={rule.enabled}
              onCheckedChange={v => onToggle(rule.id, v)}
              aria-label={`${rule.name} kuralı ${rule.enabled ? 'etkin' : 'pasif'}`}
            />
          </span>
        ),
      },
    ],
    [onToggle],
  );

  return (
    <>
      <TableSection label="Kural listesi">
        <Table<TrackingRuleItem>
          data={rules}
          columns={columns}
          getRowId={rule => rule.id}
          loading={loading}
          onRowClick={rule => router.push(`/dashboard/kurallar/${rule.id}`)}
          rowState={rule => (rule.enabled ? undefined : { className: 'opacity-60' })}
          rowMenu={rule => [
            { label: 'Düzenle', animatedIcon: PencilIcon, onSelect: () => router.push(`/dashboard/kurallar/${rule.id}`) },
            { label: 'Sil', animatedIcon: TrashIcon, destructive: true, onSelect: () => setDeleting(rule) },
          ]}
          emptyState={
            <EmptyState
              icon={SlidersHorizontal}
              message="Henüz kural yok"
              description="Koşul sağlanınca çalışacak aksiyonları tanımlayın: bildirim, e-posta ya da stok ekleme. Boş kuraldan ya da hazır şablondan başlayın."
              actionLabel="İlk kuralı oluştur"
              onAction={onCreateFirst}
            />
          }
        />
        {rules.length > 0 && <TableFooterNote>{rules.length} kural listelendi</TableFooterNote>}
      </TableSection>

      {deleting && (
        <DeleteRuleDialog
          ruleName={deleting.name}
          open
          onOpenChange={open => !open && setDeleting(null)}
          onConfirm={() => onDelete(deleting.id)}
        />
      )}
    </>
  );
}

/**
 * Aksiyon ikonları + özet. Birden çok ikon tek `useIconHover` ile sürülemez;
 * hover hücre içeriğinden gelir ve ikonların hepsini birlikte oynatır.
 */
function ActionSummary({ types, summary }: { types: readonly RuleActionType[]; summary: string }) {
  const icons = useRef(new Map<RuleActionType, AnimatedIconHandle>());
  const reduceMotion = useReducedMotion();
  return (
    <span
      className="inline-flex min-w-0 items-center gap-2 text-sm text-foreground"
      title={summary}
      onMouseEnter={() => {
        if (!reduceMotion) icons.current.forEach(icon => icon.startAnimation());
      }}
      onMouseLeave={() => icons.current.forEach(icon => icon.stopAnimation())}
    >
      <span className="inline-flex shrink-0 items-center gap-1">
        {types.map(type => (
          <ActionIcon
            key={type}
            type={type}
            ref={handle => {
              if (handle) icons.current.set(type, handle);
              else icons.current.delete(type);
            }}
          />
        ))}
      </span>
      <span className="truncate">{summary || '—'}</span>
    </span>
  );
}
