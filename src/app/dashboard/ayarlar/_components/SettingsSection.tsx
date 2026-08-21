import type { ReactNode } from 'react';

interface SettingsSectionProps {
  /** Hash derin bağlantısı için (ör. #bildirim-ayarlari). */
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}

/**
 * Tek-kart ayarlar panelinin bölüm primitifi: sol kolonda başlık+açıklama,
 * sağ kolonda kontroller (md+); dar ekranda alt alta. Kart kabuğu padding
 * taşımaz — p-6 burada yaşar ki divider'lar kenardan kenara aksın.
 */
export function SettingsSection({ id, eyebrow, title, description, children }: SettingsSectionProps) {
  return (
    <section id={id} className="grid gap-4 scroll-mt-6 p-6 md:grid-cols-[260px_minmax(0,1fr)] md:gap-x-12">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1 text-balance text-sm font-medium text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-pretty text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}
