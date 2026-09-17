import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsSection } from './SettingsSection';

/** Kural tabanlı takip kendi sayfasına taşındı; Ayarlar'da yalnız yönlendirme kalır. */
export function RulesLinkSection() {
  return (
    <SettingsSection
      id="takip-kurallari"
      eyebrow="TAKİP"
      title="Kural tabanlı takip"
      description="Ürün, tedarikçi ya da tüm katalog için kendi koşullarınızı tanımlayın — stok, satın alma ve analiz alanlarında; bildirim ya da e-posta olarak."
    >
      <div>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/dashboard/kurallar">
            Kuralları yönet
            <ArrowUpRight className="size-3" aria-hidden />
          </Link>
        </Button>
      </div>
    </SettingsSection>
  );
}
