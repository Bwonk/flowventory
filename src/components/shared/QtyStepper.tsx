'use client';

import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedNumber } from './AnimatedNumber';

interface QtyStepperProps {
  qty: number;
  onChange: (qty: number) => void;
  /** Adet 1'in altına inerse (varsa) çağrılır; yoksa 1'de durur. */
  onRemove?: () => void;
  min?: number;
  max?: number;
  /** Erişilebilir ad — satırın ürün adı. */
  label: string;
}

/**
 * Adet arttır/azalt (DESIGN.md §5): 24px hairline kutu, sayı ± ile
 * değişince `AnimatedNumber` yön farkındalıklı kayar. Sayıya tıklayınca
 * (ya da Enter) yerinde giriş açılır; blur/Enter yazılanı kaydeder,
 * boş/geçersiz giriş önceki değere döner.
 */
export function QtyStepper({ qty, onChange, onRemove, min = 1, max = 100_000, label }: QtyStepperProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(qty));
  useEffect(() => setText(String(qty)), [qty]);

  const clamp = (n: number) => Math.min(Math.max(Math.round(n), min), max);

  const commit = () => {
    setEditing(false);
    const parsed = Number(text);
    if (!Number.isFinite(parsed) || parsed < min) {
      setText(String(qty));
      return;
    }
    onChange(clamp(parsed));
  };

  const decrement = () => {
    if (qty <= min) {
      onRemove?.();
      return;
    }
    onChange(clamp(qty - 1));
  };

  return (
    <div className="flex h-6 shrink-0 items-center rounded-md border border-border bg-card">
      <Button
        variant="ghost"
        size="sm"
        className="size-5.5 rounded-r-none p-0 text-muted-foreground hover:text-foreground"
        onClick={decrement}
        aria-label={`${label} adedini azalt`}
      >
        <Minus className="size-3" aria-hidden />
      </Button>
      {editing ? (
        <input
          autoFocus
          inputMode="numeric"
          value={text}
          onChange={e => setText(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={commit}
          onFocus={e => e.currentTarget.select()}
          onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setText(String(qty));
              setEditing(false);
            }
          }}
          aria-label={`${label} adedi`}
          className="h-full w-8 bg-transparent text-center text-xs font-medium tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`${label} adedi: ${qty} — düzenlemek için tıkla`}
          className="flex h-full w-8 items-center justify-center text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <AnimatedNumber value={qty} />
        </button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="size-5.5 rounded-l-none p-0 text-muted-foreground hover:text-foreground"
        onClick={() => onChange(clamp(qty + 1))}
        aria-label={`${label} adedini artır`}
      >
        <Plus className="size-3" aria-hidden />
      </Button>
    </div>
  );
}
