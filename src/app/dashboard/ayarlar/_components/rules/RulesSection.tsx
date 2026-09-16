'use client';

import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import type { TrackingRuleItem } from '@/app/api/rules/route';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useTrackingRules } from '../../hooks/use-tracking-rules';
import { SettingsSection } from '../SettingsSection';
import { DeleteRuleDialog } from './DeleteRuleDialog';
import { RuleFormDialog } from './RuleFormDialog';

interface RulesSectionProps {
  token: string;
  notificationEmail: string | null;
  leadTimeDays: number;
}

const relativeFormatter = new Intl.RelativeTimeFormat('tr-TR', { numeric: 'auto' });

function relativeTime(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const hours = Math.round(diffMs / (60 * 60 * 1000));
  if (Math.abs(hours) < 24) return relativeFormatter.format(hours, 'hour');
  return relativeFormatter.format(Math.round(hours / 24), 'day');
}

/**
 * Takip kuralları bölümü — Ayarlar sayfasında yaşar (kullanıcı kararı; gerekirse
 * ayrı sayfaya taşınır). Liste satırı: ad + describeRule cümlesi + meta;
 * sağda etkin anahtarı, düzenle ve sil.
 */
export function RulesSection({ token, notificationEmail, leadTimeDays }: RulesSectionProps) {
  const { rules, loading, error, reload, create, update, toggle, remove } = useTrackingRules(token);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TrackingRuleItem | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (rule: TrackingRuleItem) => {
    setEditing(rule);
    setFormOpen(true);
  };

  return (
    <SettingsSection
      id="takip-kurallari"
      eyebrow="TAKİP"
      title="Kural tabanlı takip"
      description="Ürün, tedarikçi ya da tüm katalog için kendi koşullarınızı tanımlayın — ör. 24 saatte stok 50 adet düşerse. Kurallar veri yenilendikçe ve saatte bir değerlendirilir; bildirim zilde görünür."
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      ) : error ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">Kurallar alınamadı.</p>
          <Button type="button" variant="outline" size="sm" onClick={reload}>
            Tekrar dene
          </Button>
        </div>
      ) : rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz kural yok. İlk kuralınızı ekleyin.</p>
      ) : (
        <ul className="divide-y divide-hairline rounded-lg border border-hairline">
          {rules.map(rule => (
            <li key={rule.id} className={cn('flex items-start gap-3 px-4 py-3', !rule.enabled && 'opacity-60')}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{rule.name}</p>
                <p className="text-pretty text-xs text-muted-foreground">{rule.sentence}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {rule.emailEnabled ? 'Zil + e-posta' : 'Zil'}
                  {rule.lastTriggeredAt ? ` · son tetik ${relativeTime(rule.lastTriggeredAt)}` : ' · henüz tetiklenmedi'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={v => toggle(rule.id, v)}
                  aria-label={`${rule.name} kuralı ${rule.enabled ? 'etkin' : 'pasif'}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  aria-label={`${rule.name} kuralını düzenle`}
                  onClick={() => openEdit(rule)}
                >
                  <Pencil className="size-3.5" aria-hidden />
                </Button>
                <DeleteRuleDialog ruleName={rule.name} onConfirm={() => remove(rule.id)} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div>
        <Button type="button" variant="outline" className="gap-2" onClick={openCreate} disabled={loading}>
          <Plus className="size-3" aria-hidden />
          Kural ekle
        </Button>
      </div>

      <RuleFormDialog
        token={token}
        open={formOpen}
        onOpenChange={setFormOpen}
        rule={editing}
        notificationEmail={notificationEmail}
        leadTimeDays={leadTimeDays}
        onSubmit={input => (editing ? update(editing.id, input) : create(input))}
      />
    </SettingsSection>
  );
}
