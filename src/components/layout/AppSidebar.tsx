'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Store } from 'lucide-react';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { NotificationBell } from './NotificationBell';
import { OnboardingCard } from './OnboardingCard';
import { ClipboardDocumentListIcon } from '@/components/ui/icons/clipboard-document-list';
import { Cog6ToothIcon } from '@/components/ui/icons/cog-6-tooth';
import { CubeIcon } from '@/components/ui/icons/cube';
import { PresentationChartLineIcon } from '@/components/ui/icons/presentation-chart-line';
import { RectangleGroupIcon } from '@/components/ui/icons/rectangle-group';
import { useIconHover, type AnimatedIcon } from '@/components/ui/icons/use-icon-hover';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/animate-ui/components/radix/sidebar';

interface AppSidebarProps {
  storeName: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: AnimatedIcon;
  /** Yalnızca tam eşleşmede aktif (üst kırılım linkleri için). */
  exact?: boolean;
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { label: 'Genel Bakış', href: '/dashboard', icon: RectangleGroupIcon, exact: true },
  { label: 'Stok Takibi', href: '/dashboard/stok', icon: CubeIcon },
  { label: 'Satın Alma', href: '/dashboard/rapor', icon: ClipboardDocumentListIcon },
  { label: 'Analiz', href: '/dashboard/analiz', icon: PresentationChartLineIcon },
  { label: 'Ayarlar', href: '/dashboard/ayarlar', icon: Cog6ToothIcon },
];

/** Verilen href, mevcut yol için aktif mi? */
function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * Tek bir nav satırı. Her satırın kendi ikon ref'i gerektiği için ayrı bileşen:
 * hook'u map gövdesinde çağırmak Rules of Hooks ihlali olurdu.
 */
function NavMenuItem({ item, active }: { item: NavItem; active: boolean }) {
  const { ref, hoverProps } = useIconHover();
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
        <Link href={item.href} aria-current={active ? 'page' : undefined} {...hoverProps}>
          {/* Boyut açıkça veriliyor: ikon bir <div> sarmaladığı için buton
              varyantındaki [&>svg]:size-4 direkt-çocuk kuralı artık işlemiyor. */}
          <Icon ref={ref} size={16} className="flex shrink-0" aria-hidden />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * Flowventory ana navigasyon kenar çubuğu (animate-ui radix sidebar).
 * Masaüstünde ikon moduna daralabilir; dar iframe genişliklerinde Sheet olarak açılır.
 */
export function AppSidebar({ storeName }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border">
        <Link href="/dashboard" aria-label="Flowventory" className="flex min-w-0 items-center overflow-hidden px-1">
          <BrandLogo variant="mark" priority className="hidden h-9 w-9 shrink-0 group-data-[collapsible=icon]:block" />
          <BrandLogo
            variant="full"
            priority
            className="h-12 w-full object-cover group-data-[collapsible=icon]:hidden"
          />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu className="px-2 pt-2">
          {NAV_ITEMS.map(item => (
            <NavMenuItem key={item.href} item={item} active={isActive(pathname, item)} />
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <OnboardingCard />
        <NotificationBell />
        <div className="flex items-center gap-2 overflow-hidden px-2 pb-1">
          <Store className="size-4 shrink-0 text-muted-foreground" />
          <span
            className="truncate text-xs text-muted-foreground group-data-[collapsible=icon]:hidden"
            title={storeName}
          >
            {storeName}
          </span>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
