'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * Daraltma öncesi çağrılan bekçi: açık katmanını kapatır ve sidebar'ın
 * daralmadan önce beklemesi gereken süreyi (ms) döndürür; kapatacak bir şey
 * yoksa 0.
 */
type CollapseGuard = () => number;

interface SidebarCollapseGuardContextValue {
  /** Bekçiyi kaydeder; dönen fonksiyon kaydı siler. */
  register: (guard: CollapseGuard) => () => void;
}

const SidebarCollapseGuardContext = createContext<SidebarCollapseGuardContextValue | null>(null);

/**
 * Sidebar'ın kontrollü aç/kapa durumu + "önce içeridekini kapat" sıralaması.
 *
 * Sidebar daralırken içinde açık bir katman (geri bildirim paneli) varsa,
 * panel genişliği sidebar'a bağlı olduğu için daralmayla birlikte ezilerek
 * kayboluyordu. Burada daraltma isteği önce bekçilere sorulur: panel kendi
 * çıkış animasyonuyla kapanır, süre dolunca sidebar daralır. Genişletme
 * isteği her zaman anında uygulanır ve bekleyen daraltmayı iptal eder.
 *
 * `SidebarProvider`'a `open` / `onOpenChange` olarak bağlanır — Cmd+B, ray ve
 * tetikleyici aynı `setOpen`'dan geçtiği için hepsi kapsanır.
 */
export function useGuardedSidebarOpen(defaultOpen = true) {
  const [open, setOpen] = useState(defaultOpen);
  const guardsRef = useRef(new Set<CollapseGuard>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const onOpenChange = useCallback(
    (next: boolean) => {
      clearTimer();
      if (next) {
        setOpen(true);
        return;
      }
      let wait = 0;
      guardsRef.current.forEach(guard => {
        wait = Math.max(wait, guard());
      });
      if (wait === 0) {
        setOpen(false);
        return;
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setOpen(false);
      }, wait);
    },
    [clearTimer],
  );

  const contextValue = useMemo<SidebarCollapseGuardContextValue>(
    () => ({
      register: guard => {
        guardsRef.current.add(guard);
        return () => {
          guardsRef.current.delete(guard);
        };
      },
    }),
    [],
  );

  return { open, onOpenChange, contextValue };
}

export function SidebarCollapseGuardProvider({
  value,
  children,
}: {
  value: SidebarCollapseGuardContextValue;
  children: ReactNode;
}) {
  return <SidebarCollapseGuardContext.Provider value={value}>{children}</SidebarCollapseGuardContext.Provider>;
}

/**
 * Sidebar içindeki bir katmanın daraltma öncesi kapanmasını sağlar.
 * `guard` her render'da yeniden kaydedilmesin diye ref üzerinden okunur.
 */
export function useSidebarCollapseGuard(guard: CollapseGuard) {
  const ctx = useContext(SidebarCollapseGuardContext);
  const guardRef = useRef(guard);
  guardRef.current = guard;

  useEffect(() => {
    if (!ctx) return;
    return ctx.register(() => guardRef.current());
  }, [ctx]);
}
