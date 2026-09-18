'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import { useSidebar } from '@/components/animate-ui/components/radix/sidebar';
import { Loader } from 'lucide-react';
import {
  PopoverForm,
  PopoverFormCutOutLeftIcon,
  PopoverFormCutOutRightIcon,
  PopoverFormSeparator,
  PopoverFormSuccess,
} from '@/components/ui/popover-form';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { EnvelopeIcon } from '@/components/ui/icons/envelope';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import { extractErrorMessage } from '@/lib/api-error';
import { logger } from '@/lib/logger';

type FormState = 'idle' | 'loading' | 'success';

const MAX_LENGTH = 2000;
/** Kapalı yükseklik (tetikleyici satırı, h-9) ve açık panel yüksekliği. */
const TRIGGER_HEIGHT = 36;
const PANEL_HEIGHT = 168;
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
  const reduceMotion = useReducedMotion();

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
    /*
     * Açılınca panel kadar yer kaplar; SidebarContent `flex-1` olduğu için
     * footer büyüdükçe üst kenarı yukarı kayar ve OnboardingCard panelin
     * altında kalmak yerine yukarı itilir. Onboarding tamamlanmışsa kart
     * zaten render edilmiyor (OnboardingCard `return null`), davranış aynı.
     */
    <motion.div
      className="relative"
      initial={false}
      animate={{ height: open ? PANEL_HEIGHT : TRIGGER_HEIGHT }}
      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 35 }}
    >
      <PopoverForm
        className="h-full"
        title="Geri Bildirim"
        open={open}
        setOpen={handleOpenChange}
        showSuccess={formState === 'success'}
        width="100%"
        height={`${PANEL_HEIGHT}px`}
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
          /*
           * `h-full` + flex: textarea kalan yeri doldurur, aksiyon satırı tam
           * dibe oturur. Sabit `h-28` ile panelin kenarlık payı yüzünden 2px
           * taşıyordu; ayrıca textarea inline-block olduğu için satır kutusunda
           * ~7px baseline boşluğu bırakıp satırı aşağı itiyordu. Flex çocuğu
           * blok seviyesine geçtiği için o boşluk da ortadan kalkar.
           */
          <form
            className="flex h-full flex-col"
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
              className="block min-h-0 w-full flex-1 resize-none rounded-t-lg bg-card p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <div className="relative flex h-12 shrink-0 items-center px-[10px]">
              <PopoverFormSeparator />
              <div className="absolute left-0 top-0 -translate-x-[1.5px] -translate-y-1/2">
                <PopoverFormCutOutLeftIcon />
              </div>
              <div className="absolute right-0 top-0 translate-x-[1.5px] -translate-y-1/2 rotate-180">
                <PopoverFormCutOutRightIcon />
              </div>
              {/* Yarıçap varsayılanı `var(--radius-md)` — paneldeki diğer
                  kontrollerle (rounded-md) aynı değer. */}
              <ShimmerButton
                type="submit"
                disabled={formState !== 'idle'}
                shimmerDuration="2.5s"
                className="ml-auto h-6 px-3 py-0 text-xs font-medium"
              >
                {formState === 'loading' ? (
                  <Loader className="size-3 animate-spin" aria-hidden />
                ) : (
                  'Gönder'
                )}
              </ShimmerButton>
            </div>
          </form>
        }
        successChild={
          <PopoverFormSuccess title="Teşekkürler" description="Geri bildirimin bize ulaştı." />
        }
      />
    </motion.div>
  );
}
