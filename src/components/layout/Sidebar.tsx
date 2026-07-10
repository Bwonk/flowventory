'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, Settings, Store, Zap, type LucideIcon } from 'lucide-react';

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
    <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col border-r border-[#e5e7eb] bg-[#ffffff] md:w-[220px]">
      {/* Logo alanı */}
      <div className="flex h-16 items-center gap-2 border-b border-[#e5e7eb] px-4 md:px-5">
        <Zap className="h-5 w-5 shrink-0 text-[#17171c]" />
        <span className="hidden text-[16px] font-semibold tracking-tight text-[#17171c] md:inline">Flowventory</span>
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
                  ? 'bg-[#f3f4f6] font-medium text-[#17171c]'
                  : 'text-[#75758a] hover:bg-[#f8f9fa] hover:text-[#17171c]'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 md:mr-3" />
              <span className="hidden truncate md:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Alt alan — mağaza adı */}
      <div className="flex items-center gap-2 border-t border-[#e5e7eb] p-4">
        <Store className="h-4 w-4 shrink-0 text-[#75758a]" />
        <span className="hidden truncate text-[12px] text-[#75758a] md:inline" title={storeName}>
          {storeName}
        </span>
      </div>
    </aside>
  );
}
