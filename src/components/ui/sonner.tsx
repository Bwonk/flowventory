'use client';

import { Toaster as Sonner } from 'sonner';

/**
 * shadcn CLI yerine elle sarılmış Toaster: CLI sürümü next-themes ister,
 * proje light-only (DESIGN.md). Toast yüzen katmandır — gölge serbest
 * (DESIGN.md §7 popover istisnası).
 */
export function Toaster() {
  return (
    <Sonner
      theme="light"
      // Sağ alt köşe sepet çekmecesinin altbilgisini (toplam + gönder) örtüyordu.
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast: 'rounded-lg! border-hairline! bg-card! text-foreground! text-sm!',
          actionButton: 'bg-primary! text-primary-foreground! font-medium!',
        },
      }}
    />
  );
}
