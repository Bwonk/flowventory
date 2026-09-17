'use client';

import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditableTitleProps {
  value: string;
  onChange: (value: string) => void;
  /** Boş başlıkta görünen soluk metin. */
  placeholder: string;
  maxLength?: number;
  /** Düzenleme alanının erişilebilir adı (ör. "Kural adı"). */
  'aria-label': string;
  className?: string;
}

const TITLE_CLASS = 'text-2xl font-semibold tracking-tight';

/**
 * Notion tarzı satır içi başlık: h1 görünümü; hover'da sağında kalem, tıkla
 * ya da Enter → aynı tipografide input. Enter/blur kaydeder, Esc geri alır.
 * `PageHeader.titleSlot` ile kullanılır.
 */
export function EditableTitle({ value, onChange, placeholder, maxLength = 80, 'aria-label': ariaLabel, className }: EditableTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  // Esc sonrası gelen blur taslağı kaydetmesin.
  const cancelled = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const start = () => {
    cancelled.current = false;
    setDraft(value);
    setEditing(true);
  };

  const commit = () => {
    if (!cancelled.current) onChange(draft.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel}
        size={Math.max(draft.length, placeholder.length, 8)}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            inputRef.current?.blur();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelled.current = true;
            inputRef.current?.blur();
          }
        }}
        className={cn(
          TITLE_CLASS,
          'min-w-0 max-w-full rounded-md bg-transparent px-1 -mx-1 text-foreground outline-none ring-1 ring-hairline placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      />
    );
  }

  return (
    <h1 className={cn(TITLE_CLASS, 'min-w-0', className)}>
      <button
        type="button"
        onClick={start}
        aria-label={`${ariaLabel}: ${value || placeholder} — düzenle`}
        className="group -mx-1 inline-flex max-w-full items-center gap-2 rounded-md px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className={cn('truncate', value ? 'text-foreground' : 'text-muted-foreground')}>{value || placeholder}</span>
        <Pencil
          className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        />
      </button>
    </h1>
  );
}
