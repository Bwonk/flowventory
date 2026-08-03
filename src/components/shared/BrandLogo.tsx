import Image from 'next/image';
import { cn } from '@/lib/utils';

type BrandLogoVariant = 'mark' | 'full';

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  className?: string;
  priority?: boolean;
}

const ASSETS = {
  mark: {
    src: '/flowventory-app-icon.png',
    width: 128,
    height: 128,
  },
  full: {
    src: '/flowventory-logo.png',
    width: 320,
    height: 180,
  },
} as const;

/**
 * Flowventory marka logosu.
 * - mark: kare app icon (dar sidebar / auth)
 * - full: yatay wordmark (geniş sidebar)
 *
 * Kaynak PNG'ler çok yüksek çözünürlüklü; optimizer'ı atlıyoruz.
 */
export function BrandLogo({ variant = 'full', className, priority = false }: BrandLogoProps) {
  const asset = ASSETS[variant];

  return (
    <Image
      src={asset.src}
      alt="Flowventory"
      width={asset.width}
      height={asset.height}
      priority={priority}
      unoptimized
      className={cn(
        'object-contain',
        variant === 'mark' ? 'h-8 w-8' : 'h-8 w-auto',
        className,
      )}
    />
  );
}
