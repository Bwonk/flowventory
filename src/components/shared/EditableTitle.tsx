'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { CheckIcon, type CheckIconHandle } from '@/components/ui/icons/check';
import { PencilIcon } from '@/components/ui/icons/pencil';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { PRESS_FEEDBACK_CLASS } from '@/lib/motion';
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
/** Tuş vuruşu ve tik butonu aynı kutuda; ikon 16px, metinle arası `gap-2`. */
const ICON_CLASS = 'flex shrink-0 text-muted-foreground';

/**
 * Notion tarzı satır içi başlık (`PageHeader.titleSlot`). Tek bir alan iki
 * halde yaşar, kabuk aynı kaldığı için geçiş zıplamaz (DESIGN.md §5 "Satır içi
 * başlık"): dinlenmede başlık + hep görünen soluk kalem (düzenlenebilirliğin
 * işareti; hover'da alan `bg-muted` olur, kalem oynar), düzenlemede `bg-card`
 * + hairline → odak halkası ve kalemin yerine çizilerek gelen tik. Enter/blur/
 * tik kaydeder, Esc geri alır.
 *
 * Genişlik görünmez bir ölçü metninden gelir (`inline-grid` — input onun
 * üstüne biner): `size` özniteliği orantılı fontta ya taşırır ya boşluk
 * bırakırdı. Negatif kenar boşluğu kabukta değil `h1`'dedir; kabukta
 * `max-w-full` ile birlikte kendi kendini 8px daraltıp her başlığı kırpıyordu.
 */
export function EditableTitle({ value, onChange, placeholder, maxLength = 80, 'aria-label': ariaLabel, className }: EditableTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const checkRef = useRef<CheckIconHandle>(null);
  const pencil = useIconHover();
  const reduceMotion = useReducedMotion();
  // Esc sonrası gelen blur taslağı kaydetmesin.
  const cancelled = useRef(false);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.select();
    if (!reduceMotion) checkRef.current?.startAnimation();
  }, [editing, reduceMotion]);

  const start = () => {
    cancelled.current = false;
    setDraft(value);
    setEditing(true);
  };

  const commit = () => {
    if (!cancelled.current) onChange(draft.trim());
    setEditing(false);
  };

  return (
    <h1 className={cn(TITLE_CLASS, '-mx-1 min-w-0', className)}>
      <span
        className={cn(
          'inline-flex max-w-full items-center gap-2 rounded-md px-1 transition-[background-color,box-shadow] duration-150',
          editing
            ? 'bg-card ring-1 ring-hairline focus-within:ring-2 focus-within:ring-ring'
            : 'hover:bg-muted has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
        )}
        {...(editing ? {} : pencil.hoverProps)}
      >
        {editing ? (
          <>
            <span className="inline-grid min-w-0 items-center">
              {/* Ölçü metni: input bu genişliğe oturur. Sondaki boşluk da sayılsın diye `whitespace-pre`. */}
              <span aria-hidden className="invisible col-start-1 row-start-1 overflow-hidden whitespace-pre">
                {draft || placeholder}
              </span>
              <input
                ref={inputRef}
                // Varsayılan 20 karakterlik iç genişlik ızgara kolonunu şişirmesin; genişliği ölçü metni verir.
                size={1}
                value={draft}
                maxLength={maxLength}
                placeholder={placeholder}
                aria-label={ariaLabel}
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
                className="col-start-1 row-start-1 w-0 min-w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              />
            </span>
            {/* `onMouseDown` varsayılanı engellenir: tıklama input'u blur edip iki kez kaydetmesin; kayıt blur'dan geçer. */}
            <button
              type="button"
              aria-label="Kaydet"
              onMouseDown={e => e.preventDefault()}
              onClick={() => inputRef.current?.blur()}
              className={cn('flex shrink-0 rounded-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', PRESS_FEEDBACK_CLASS)}
            >
              <CheckIcon ref={checkRef} size={16} className="flex" aria-hidden />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={start}
            aria-label={`${ariaLabel}: ${value || placeholder} — düzenle`}
            className={cn('inline-flex min-w-0 max-w-full items-center gap-2 text-left focus-visible:outline-none', PRESS_FEEDBACK_CLASS)}
          >
            <span className={cn('truncate', value ? 'text-foreground' : 'text-muted-foreground')}>{value || placeholder}</span>
            <PencilIcon ref={pencil.ref} size={16} className={ICON_CLASS} aria-hidden />
          </button>
        )}
      </span>
    </h1>
  );
}
