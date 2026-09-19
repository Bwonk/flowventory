'use client';

import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from './AnimatedNumber';

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** ± bir basışta değişen miktar. */
  step?: number;
  /** 'sm' = 24px liste satırı (sepet), 'md' = 36px form alanı (`Input` yüksekliği). */
  size?: 'sm' | 'md';
  /** Değer `min`'in altına inerse (varsa) çağrılır; yoksa `min`'de durur. */
  onRemove?: () => void;
  /** Erişilebilir ad — satırın ürün adı ya da alanın etiketi. */
  label: string;
  disabled?: boolean;
  /** Satır içi düzenlemede kutu doğrudan yazma modunda açılır. */
  autoFocus?: boolean;
  /**
   * Enter ile kaydedildikten sonra, **kaydedilen değerle**: `onChange` bir state
   * güncellemesi planlar, bu geri çağrı hemen ardından senkron çalışır — üst
   * bileşen kendi `value`'sunu okusa eski değeri görürdü.
   */
  onEnter?: (value: number) => void;
  /** Escape ile vazgeçilince. */
  onEscape?: () => void;
  /** Sayı alanının genişliğini ezmek için (varsayılan: `sm` 32px, `md` 56px). */
  fieldClassName?: string;
  className?: string;
}

const SIZES = {
  sm: { box: 'h-6', button: 'size-5.5', field: 'w-8', text: 'text-xs', icon: 'size-3' },
  md: { box: 'h-9', button: 'size-8', field: 'w-14', text: 'text-sm', icon: 'size-3.5' },
} as const;

/**
 * Sayı arttır/azalt (DESIGN.md §5 "Sayı alanı"): hairline kutu, ± butonları ve
 * ortada `AnimatedNumber` — değer değişince sayı yön farkındalıklı kayar
 * (artışta alttan gelir, azalışta üstten). Sayıya tıklayınca (ya da Enter)
 * yerinde giriş açılır; blur/Enter yazılanı kaydeder, boş/geçersiz giriş
 * önceki değere döner.
 *
 * Uygulamadaki **tek** sayı girişi kalıbıdır: `<Input type="number">`in tarayıcı
 * okları hem platforma göre değişiyor hem de animasyonsuzdu.
 */
export function NumberStepper({
  value,
  onChange,
  min = 1,
  max = 100_000,
  step = 1,
  size = 'sm',
  onRemove,
  label,
  disabled,
  autoFocus,
  onEnter,
  onEscape,
  fieldClassName,
  className,
}: NumberStepperProps) {
  const [editing, setEditing] = useState(Boolean(autoFocus));
  const [text, setText] = useState(String(value));
  // Enter kendi commit'ini yapar; hemen ardından gelen blur onu tekrarlamasın.
  const committed = useRef(false);
  useEffect(() => setText(String(value)), [value]);
  const s = SIZES[size];

  const clamp = (n: number) => Math.min(Math.max(Math.round(n), min), max);

  /** Yazılanı kaydeder ve kaydedilen (kıskaçlanmış) değeri döndürür. */
  const commit = () => {
    committed.current = true;
    setEditing(false);
    const parsed = Number(text);
    if (!Number.isFinite(parsed) || parsed < min) {
      setText(String(value));
      return value;
    }
    const next = clamp(parsed);
    onChange(next);
    return next;
  };

  const decrement = () => {
    if (value <= min) {
      onRemove?.();
      return;
    }
    onChange(clamp(value - step));
  };

  return (
    <div className={cn('flex shrink-0 items-center rounded-md border border-border bg-card', s.box, disabled && 'opacity-60', className)}>
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled || (!onRemove && value <= min)}
        className={cn('rounded-r-none p-0 text-muted-foreground hover:text-foreground', s.button)}
        onClick={decrement}
        aria-label={`${label} azalt`}
      >
        <Minus className={s.icon} aria-hidden />
      </Button>
      {editing ? (
        <input
          autoFocus
          inputMode="numeric"
          value={text}
          disabled={disabled}
          onChange={e => setText(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={() => {
            if (!committed.current) commit();
          }}
          onFocus={e => {
            committed.current = false;
            e.currentTarget.select();
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              // `blur` commit'i tetikler; dönüş değerini alabilmek için burada çağrılır.
              const next = commit();
              e.currentTarget.blur();
              onEnter?.(next);
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              committed.current = true;
              setText(String(value));
              setEditing(false);
              onEscape?.();
            }
          }}
          aria-label={label}
          className={cn(
            'h-full bg-transparent text-center font-medium tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            s.field,
            s.text,
            fieldClassName,
          )}
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setEditing(true)}
          aria-label={`${label}: ${value} — düzenlemek için tıkla`}
          className={cn(
            'flex h-full items-center justify-center font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            s.field,
            s.text,
            fieldClassName,
          )}
        >
          <AnimatedNumber value={value} />
        </button>
      )}
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled || value >= max}
        className={cn('rounded-l-none p-0 text-muted-foreground hover:text-foreground', s.button)}
        onClick={() => onChange(clamp(value + step))}
        aria-label={`${label} artır`}
      >
        <Plus className={s.icon} aria-hidden />
      </Button>
    </div>
  );
}
