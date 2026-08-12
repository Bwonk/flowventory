'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChartPie, ClipboardList, LayoutDashboard, Package, Settings, Store, type LucideIcon } from 'lucide-react';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { NotificationBell } from './NotificationBell';
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
  icon: LucideIcon;
  /** Yalnızca tam eşleşmede aktif (üst kırılım linkleri için). */
  exact?: boolean;
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
  { label: 'Stok Takibi', href: '/dashboard/stok', icon: Package },
  { label: 'Satın Alma', href: '/dashboard/rapor', icon: ClipboardList },
  { label: 'Analiz', href: '/dashboard/analiz', icon: ChartPie },
  { label: 'Ayarlar', href: '/dashboard/ayarlar', icon: Settings },
];

/** Verilen href, mevcut yol için aktif mi? */
function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * Flowventory ana navigasyon kenar çubuğu (animate-ui radix sidebar).
 * Masaüstünde ikon moduna daralabilir; dar iframe genişliklerinde Sheet olarak açılır.
 */
export function AppSidebar({ storeName }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
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
          {NAV_ITEMS.map(item => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                  <Link href={item.href} aria-current={active ? 'page' : undefined}>
                    <Icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
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
