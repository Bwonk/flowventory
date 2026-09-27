'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Store } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { NotificationBell } from './NotificationBell';
import { SidebarFeedback } from './SidebarFeedback';
import { AdjustmentsHorizontalIcon } from '@/components/ui/icons/adjustments-horizontal';
import { ClipboardDocumentListIcon } from '@/components/ui/icons/clipboard-document-list';
import { Cog6ToothIcon } from '@/components/ui/icons/cog-6-tooth';
import { CubeIcon } from '@/components/ui/icons/cube';
import { PresentationChartLineIcon } from '@/components/ui/icons/presentation-chart-line';
import { RectangleGroupIcon } from '@/components/ui/icons/rectangle-group';
import { RocketLaunchIcon } from '@/components/ui/icons/rocket-launch';
import { useIconHover, type AnimatedIcon } from '@/components/ui/icons/use-icon-hover';
import { useSubscription } from '@/lib/billing/use-subscription';
import { useOnboardingSteps } from '@/lib/onboarding';
import { getOnboardingNavState } from '@/lib/onboarding-nav';
import { EASE_OUT } from '@/lib/motion';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
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
  { label: 'Kurallar', href: '/dashboard/kurallar', icon: AdjustmentsHorizontalIcon },
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

const BASLARKEN_HREF = '/dashboard/baslarken';

/**
 * "Başlarken" satırı — eski footer kartının yerine. Kurulum sürerken ilerleme
 * rozeti ("2/4"), kurulum bitti ama abonelik aktif değilse abonelik rozeti;
 * ikisi de tamamsa satır çöker ve kaybolur (getOnboardingNavState).
 */
function OnboardingNavItem({ pathname }: { pathname: string }) {
  const onboarding = useOnboardingSteps();
  const { summary } = useSubscription();
  const reduceMotion = useReducedMotion();
  const { ref, hoverProps } = useIconHover();
  const { visible, badge } = getOnboardingNavState({
    doneCount: onboarding.doneCount,
    total: onboarding.total,
    complete: onboarding.complete,
    dismissed: onboarding.dismissed,
    subscription: summary?.state ?? null,
  });
  const active = pathname === BASLARKEN_HREF;
  const tooltip = badge ? `Başlarken · ${badge}` : 'Başlarken';

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.li
          key="baslarken"
          data-slot="sidebar-menu-item"
          data-sidebar="menu-item"
          className="group/menu-item relative"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{
            opacity: { duration: reduceMotion ? 0 : 0.15 },
            height: { duration: reduceMotion ? 0 : 0.2, ease: EASE_OUT },
          }}
        >
          <SidebarMenuButton asChild isActive={active} tooltip={tooltip}>
            <Link href={BASLARKEN_HREF} aria-current={active ? 'page' : undefined} {...hoverProps}>
              <RocketLaunchIcon ref={ref} size={16} className="flex shrink-0" aria-hidden />
              <span>Başlarken</span>
            </Link>
          </SidebarMenuButton>
          {badge && (
            <SidebarMenuBadge className="font-mono text-[10px] text-muted-foreground">
              {badge}
            </SidebarMenuBadge>
          )}
        </motion.li>
      )}
    </AnimatePresence>
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
          <OnboardingNavItem pathname={pathname} />
          {NAV_ITEMS.map(item => (
            <NavMenuItem key={item.href} item={item} active={isActive(pathname, item)} />
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <NotificationBell />
        <SidebarFeedback />
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
