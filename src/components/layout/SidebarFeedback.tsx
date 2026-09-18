'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { useSidebar } from '@/components/animate-ui/components/radix/sidebar';
import {
  PopoverForm,
  PopoverFormButton,
  PopoverFormCutOutLeftIcon,
  PopoverFormCutOutRightIcon,
  PopoverFormSeparator,
  PopoverFormSuccess,
} from '@/components/ui/popover-form';
import { EnvelopeIcon } from '@/components/ui/icons/envelope';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import { extractErrorMessage } from '@/lib/api-error';
import { logger } from '@/lib/logger';

type FormState = 'idle' | 'loading' | 'success';

const MAX_LENGTH = 2000;
/** Sidebar'ın kendi genişlik geçişi (bkz. sidebar primitive: duration-400). */
const SIDEBAR_TRANSITION_MS = 400;
const SUCCESS_HOLD_MS = 2500;

/**
 * Sidebar footer'ında "Geri Bildirim" satırı — Bildirimler'in hemen altında,
 * onunla aynı satır dilinde. Tıklayınca yukarı doğru morph ile açılan panel
 * (cult-ui popover-form) mesajı `/api/feedback` üzerinden e-postaya çevirir.
 *
 * Panel sidebar sınırları içinde kalır: genişlik `100%` (footer içerik kutusu),
 * masaüstünde 224px, mobil Sheet'te 272px.
 */
export function SidebarFeedback() {
  const [open, setOpen] = useState(false);
  const [formState, setFormState] = useState<FormState>('idle');
  const [message, setMessage] = useState('');
  const pathname = usePathname();
  const { state, setOpen: setSidebarOpen } = useSidebar();
  const { ref: iconRef, hoverProps } = useIconHover();

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms));
  }, []);

  /**
   * İkon modunda (48px) panel sığmaz: önce sidebar'ı aç, genişlik geçişi
   * bitince paneli göster. Tek tık, morph sırasında taşma yok.
   */
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next && state === 'collapsed') {
        setSidebarOpen(true);
        schedule(() => setOpen(true), SIDEBAR_TRANSITION_MS);
        return;
      }
      // Başarı ekranı açıkken dışarı tıklanırsa: bir sonraki açılış temiz
      // forma düşsün, 2.5sn'lik sıfırlama zamanlayıcısını bekleme.
      if (!next && formState === 'success') {
        setFormState('idle');
        setMessage('');
      }
      setOpen(next);
    },
    [state, setSidebarOpen, schedule, formState],
  );

  const submit = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setFormState('loading');
    try {
      const token = await TokenHelpers.getTokenForIframeApp();
      if (!token) throw new Error('missing token');

      await ApiRequests.feedback.send(token, { message: trimmed, path: pathname });

      setFormState('success');
      schedule(() => {
        setOpen(false);
        setFormState('idle');
        setMessage('');
      }, SUCCESS_HOLD_MS);
    } catch (error) {
      logger.error('Feedback send failed', { error });
      setFormState('idle');
      toast.error(extractErrorMessage(error, 'Geri bildirim gönderilemedi.'));
    }
  }, [message, pathname, schedule]);

  // Escape yalnız paneli kapatır — mobilde sidebar Sheet'i açık kalmalı.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  return (
    <PopoverForm
      title="Geri Bildirim"
      open={open}
      setOpen={handleOpenChange}
      showSuccess={formState === 'success'}
      width="100%"
      height="168px"
      panelClassName="bottom-0 left-0 z-50"
      triggerClassName="relative h-9 w-full rounded-lg border-0 bg-transparent px-3 text-sm font-normal text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
      triggerChildren={
        <span className="flex items-center" {...hoverProps}>
          <EnvelopeIcon
            ref={iconRef}
            size={16}
            className="mr-3 flex shrink-0 group-data-[collapsible=icon]:mr-0"
            aria-hidden
          />
          <span className="truncate group-data-[collapsible=icon]:hidden">Geri Bildirim</span>
        </span>
      }
      openChild={
        <form
          onSubmit={event => {
            event.preventDefault();
            if (formState !== 'idle') return;
            submit();
          }}
        >
          <textarea
            autoFocus
            required
            maxLength={MAX_LENGTH}
            placeholder="Neyi daha iyi yapabiliriz?"
            value={message}
            onChange={event => setMessage(event.target.value)}
            aria-label="Geri bildirim mesajı"
            className="h-28 w-full resize-none rounded-t-lg bg-card p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="relative flex h-12 items-center px-[10px]">
            <PopoverFormSeparator />
            <div className="absolute left-0 top-0 -translate-x-[1.5px] -translate-y-1/2">
              <PopoverFormCutOutLeftIcon />
            </div>
            <div className="absolute right-0 top-0 translate-x-[1.5px] -translate-y-1/2 rotate-180">
              <PopoverFormCutOutRightIcon />
            </div>
            <PopoverFormButton loading={formState === 'loading'} text="Gönder" />
          </div>
        </form>
      }
      successChild={
        <PopoverFormSuccess title="Teşekkürler" description="Geri bildirimin bize ulaştı." />
      }
    />
  );
}
