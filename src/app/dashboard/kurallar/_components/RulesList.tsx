'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Mail, Pencil, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { TrackingRuleItem } from '@/app/api/rules/route';
import { Table, type TableColumn } from '@/components/motion/table';
import { EmptyState } from '@/components/shared/data-table/EmptyState';
import { TableFooterNote } from '@/components/shared/data-table/TableFooterNote';
import { TableSection } from '@/components/shared/data-table/TableSection';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { CHANNEL_LABELS, DOMAIN_LABELS } from '@/lib/rules/types';
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
        key: 'domain',
        header: 'Alan',
        width: '124px',
        cell: rule => <Badge variant="outline">{DOMAIN_LABELS[rule.domain]}</Badge>,
      },
      {
        key: 'channel',
        header: 'Kanal',
        width: '112px',
        cell: rule => (
          <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
            {rule.channel === 'email' ? <Mail className="size-3.5 text-muted-foreground" aria-hidden /> : <Bell className="size-3.5 text-muted-foreground" aria-hidden />}
            {CHANNEL_LABELS[rule.channel]}
          </span>
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
            { label: 'Düzenle', icon: <Pencil className="size-3.5" aria-hidden />, onSelect: () => router.push(`/dashboard/kurallar/${rule.id}`) },
            { label: 'Sil', icon: <Trash2 className="size-3.5" aria-hidden />, destructive: true, onSelect: () => setDeleting(rule) },
          ]}
          emptyState={
            <EmptyState
              icon={SlidersHorizontal}
              message="Henüz kural yok"
              description="Ürün, tedarikçi ya da tüm katalog için koşul tanımlayın; tetiklenince zilde ya da e-postada görün."
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
