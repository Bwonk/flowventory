'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, Settings, Store, type LucideIcon } from 'lucide-react';
import { BrandLogo } from '@/components/shared/BrandLogo';

interface SidebarProps {
  storeName: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Yalnızca tam eşleşmede aktif (üst kırılım linkleri için). */
  exact?: boolean;
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
  { label: 'Stok Takibi', href: '/dashboard/stok', icon: Package },
  { label: 'Ayarlar', href: '/dashboard/ayarlar', icon: Settings },
];

/** Verilen href, mevcut yol için aktif mi? */
function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * Flowventory ana navigasyon kenar çubuğu.
 * Masaüstünde 220px sabit; küçük ekranlarda 64px (yalnızca ikon).
 */
export default function Sidebar({ storeName }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col border-r border-border bg-background md:w-[220px]">
      {/* Logo alanı — PNG'de fazla boşluk var; object-cover ile kırpıp büyütüyoruz */}
      <div className="flex h-20 items-center overflow-hidden border-b border-border px-1 md:px-2">
        <Link href="/dashboard" aria-label="Flowventory" className="flex w-full min-w-0 items-center overflow-hidden">
          <BrandLogo variant="mark" priority className="h-12 w-12 md:hidden" />
          <BrandLogo
            variant="full"
            priority
            className="hidden h-14 w-full object-cover md:block"
          />
        </Link>
      </div>

      {/* Navigasyon öğeleri */}
      <nav className="flex flex-1 flex-col gap-1 px-3 pt-4">
        {NAV_ITEMS.map(item => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              title={item.label}
              className={`flex h-9 items-center rounded-lg px-3 text-[14px] transition-colors duration-100 ${
                active
                  ? 'bg-muted font-medium text-primary'
                  : 'text-slate hover:bg-muted hover:text-primary'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 md:mr-3" />
              <span className="hidden truncate md:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Alt alan — mağaza adı */}
      <div className="flex items-center gap-2 border-t border-border p-4">
        <Store className="h-4 w-4 shrink-0 text-slate" />
        <span className="hidden truncate text-[12px] text-slate md:inline" title={storeName}>
          {storeName}
        </span>
      </div>
    </aside>
  );
}
