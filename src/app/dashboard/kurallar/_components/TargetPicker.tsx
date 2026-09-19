'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Dropdown, OptionButton } from '@/components/shared/filters/Dropdown';

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
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  onChange: (option: TargetOption) => void;
}

/**
 * Ürün/tedarikçi seçici — goo `Dropdown`'ı içinde arama kutusu + seçenek
 * listesi. Aramadan ↓ ile listeye inilir (goo panelde typeahead yok, tuşlar durdurulmaz).
 */
export function TargetPicker({ options, loading, value, placeholder, searchPlaceholder, emptyText, onChange }: TargetPickerProps) {
  const [query, setQuery] = useState('');
  const selected = options.find(o => o.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    const list = q ? options.filter(o => o.label.toLocaleLowerCase('tr').includes(q)) : options;
    return list.slice(0, 200);
  }, [options, query]);

  return (
    <Dropdown
      goo
      label={selected ? selected.label : loading ? 'Yükleniyor…' : placeholder}
      active={Boolean(selected)}
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
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">{loading ? 'Yükleniyor…' : emptyText}</p>
            ) : (
              filtered.map(o => (
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
        </div>
      )}
    </Dropdown>
  );
}
