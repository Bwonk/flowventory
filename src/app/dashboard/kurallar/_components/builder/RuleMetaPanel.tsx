'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { RuleEventItem } from '@/lib/rules/serialize';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SegmentedTrack } from '@/components/shared/tool-track';
import {
  CHANNEL_LABELS,
  DOMAIN_LABELS,
  RULE_WINDOWS,
  SCOPE_LABELS,
  WINDOW_LABELS,
  type RuleChannel,
  type RuleScope,
  type RuleWindowHours,
} from '@/lib/rules/types';
import { TargetPicker, type TargetOption } from '../TargetPicker';
import { relativeTime } from '../RulesList';
import type { BuilderState } from './use-rule-builder';

const SCOPE_OPTIONS: ReadonlyArray<{ value: RuleScope; label: string }> = [
  { value: 'all', label: SCOPE_LABELS.all },
  { value: 'product', label: SCOPE_LABELS.product },
  { value: 'vendor', label: SCOPE_LABELS.vendor },
];
const CHANNEL_OPTIONS: ReadonlyArray<{ value: RuleChannel; label: string }> = [
  { value: 'notification', label: CHANNEL_LABELS.notification },
  { value: 'email', label: CHANNEL_LABELS.email },
];
const WINDOW_OPTIONS = RULE_WINDOWS.map(h => ({ value: `${h}` as `${RuleWindowHours}`, label: WINDOW_LABELS[h] }));

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  const className = 'mb-1 block text-xs text-muted-foreground';
  return (
    <div>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={className}>
          {label}
        </label>
      ) : (
        <p className={className}>{label}</p>
      )}
      {children}
    </div>
  );
}

interface RuleMetaPanelProps {
  state: BuilderState;
  patch: (p: Partial<BuilderState>) => void;
  setScope: (scope: RuleScope) => void;
  products: TargetOption[];
  vendors: TargetOption[];
  optionsLoading: boolean;
  notificationEmail: string | null;
  events?: RuleEventItem[];
}

/** Sol kolon: ad, kapsam/hedef, kanal, alan (salt okunur), yeniden bildirim aralığı; düzenlemede son tetikler. */
export function RuleMetaPanel({ state, patch, setScope, products, vendors, optionsLoading, notificationEmail, events }: RuleMetaPanelProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-hairline bg-card p-4">
      <Field label="Kural adı" htmlFor="ruleName">
        <Input id="ruleName" value={state.name} maxLength={80} placeholder="ör. Hızlı eriyen ürünler" onChange={e => patch({ name: e.target.value })} />
      </Field>

      <Field label="Kapsam">
        <div className="flex flex-col gap-2">
          <SegmentedTrack options={SCOPE_OPTIONS} value={state.scope} onChange={setScope} aria-label="Kural kapsamı" size="sm" />
          {state.scope === 'product' && (
            <TargetPicker
              options={products}
              loading={optionsLoading}
              value={state.targetId}
              placeholder="Ürün seç"
              searchPlaceholder="Ürün ara"
              emptyText="Ürün bulunamadı"
              onChange={o => patch({ targetId: o.id, targetLabel: o.label })}
            />
          )}
          {state.scope === 'vendor' && (
            <TargetPicker
              options={vendors}
              loading={optionsLoading}
              value={state.targetId}
              placeholder="Tedarikçi seç"
              searchPlaceholder="Tedarikçi ara"
              emptyText="Tedarikçi atanmış ürün yok"
              onChange={o => patch({ targetId: o.id, targetLabel: o.label })}
            />
          )}
        </div>
      </Field>

      <Field label="Kanal">
        <SegmentedTrack
          options={CHANNEL_OPTIONS.map(o => ({ ...o, 'aria-label': o.value === 'email' && !notificationEmail ? 'E-posta (bildirim adresi gerekli)' : undefined }))}
          value={state.channel}
          onChange={c => {
            if (c === 'email' && !notificationEmail) return;
            patch({ channel: c });
          }}
          aria-label="Bildirim kanalı"
          size="sm"
        />
        {!notificationEmail && (
          <p className="mt-1 text-xs text-muted-foreground">
            E-posta için önce{' '}
            <Link href="/dashboard/ayarlar#bildirim-ayarlari" className="text-accent-blue underline-offset-4 hover:underline">
              bildirim adresi
            </Link>{' '}
            ayarlayın.
          </p>
        )}
      </Field>

      <Field label="Alan">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{DOMAIN_LABELS[state.domain]}</Badge>
          <span className="text-xs text-muted-foreground">koşul kataloğunu belirler; değiştirmek için yeni kural</span>
        </div>
      </Field>

      <Field label="Yeniden bildirim aralığı">
        <SegmentedTrack
          options={WINDOW_OPTIONS}
          value={`${state.cooldownHours}` as `${RuleWindowHours}`}
          onChange={v => patch({ cooldownHours: Number(v) as RuleWindowHours })}
          aria-label="Yeniden bildirim aralığı"
          size="sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">Aynı ürün için bu aralıkta en fazla bir kez tetiklenir.</p>
      </Field>

      {events && (
        <div className="border-t border-hairline pt-4">
          <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Son tetiklenmeler</p>
          {events.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">Henüz tetiklenmedi.</p>
          ) : (
            <ul className="mt-2 divide-y divide-hairline">
              {events.map(e => (
                <li key={e.id} className="py-2">
                  <Link href={`/dashboard/stok?product=${e.productId}`} className="block truncate text-sm font-medium text-foreground hover:underline underline-offset-4">
                    {e.productName}
                  </Link>
                  <p className="text-pretty text-xs text-muted-foreground">{e.body}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {CHANNEL_LABELS[e.channel]} · {relativeTime(e.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
