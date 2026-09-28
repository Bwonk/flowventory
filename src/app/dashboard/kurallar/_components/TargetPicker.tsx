'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Dropdown, OptionButton } from '@/components/shared/filters/Dropdown';

/** Liste performansı için üst sınır; fazlası aramayla bulunur (sınır söylenir). */
const MAX_VISIBLE = 200;

export interface TargetOption {
  id: string;
  label: string;
  /** Satır altı küçük bilgi (ör. "12 adet"). */
  hint?: string;
}

interface TargetPickerProps {
  options: TargetOption[];
  loading: boolean;
  value: string | null;
  /** Kayıtlı hedefin adı — seçenek listede yoksa (ürün silinmiş, yerel tedarikçi) yine gösterilir. */
  valueLabel?: string | null;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  onChange: (option: TargetOption) => void;
}

/**
 * Ürün/tedarikçi seçici — filtre `Dropdown`'ı içinde arama kutusu + seçenek
 * listesi. Aramadan ↓ ile listeye inilir (goo panelde typeahead yok, tuşlar durdurulmaz).
 */
export function TargetPicker({ options, loading, value, valueLabel, placeholder, searchPlaceholder, emptyText, onChange }: TargetPickerProps) {
  const [query, setQuery] = useState('');
  const selected = options.find(o => o.id === value) ?? null;
  // Seçili ama listede olmayan hedef boş görünüyordu ("Ürün seç"); kayıtlı adı göster.
  const selectedLabel = selected?.label ?? (value ? valueLabel ?? null : null);

  const { visible, total } = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    const list = q ? options.filter(o => o.label.toLocaleLowerCase('tr').includes(q)) : options;
    return { visible: list.slice(0, MAX_VISIBLE), total: list.length };
  }, [options, query]);

  return (
    <Dropdown
      label={selectedLabel ?? (loading ? 'Yükleniyor…' : placeholder)}
      active={Boolean(selectedLabel)}
      panelClassName="w-80 max-w-[calc(100vw-2rem)] p-1.5"
    >
      {close => (
        <div className="flex flex-col gap-1">
          <Input
            autoFocus
            value={query}
            placeholder={searchPlaceholder}
            onChange={e => setQuery(e.target.value)}
            aria-label={searchPlaceholder}
            className="h-8"
          />
          <div className="max-h-64 overflow-y-auto overscroll-contain">
            {visible.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">{loading ? 'Yükleniyor…' : emptyText}</p>
            ) : (
              visible.map(o => (
                <OptionButton
                  key={o.id}
                  label={o.hint ? `${o.label} · ${o.hint}` : o.label}
                  selected={o.id === value}
                  onClick={() => {
                    onChange(o);
                    close();
                  }}
                />
              ))
            )}
          </div>
          {total > visible.length && (
            <p className="px-3 pb-1 text-xs text-muted-foreground">
              {total.toLocaleString('tr-TR')} sonuçtan ilk {MAX_VISIBLE}; aramayı daraltın.
            </p>
          )}
        </div>
      )}
    </Dropdown>
  );
}
