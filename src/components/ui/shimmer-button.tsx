'use client';

import React, { type ComponentPropsWithoutRef, type CSSProperties } from 'react';

import { cn } from '@/lib/utils';

/**
 * magicui "shimmer-button" — kenarında dönen parıltı taşıyan buton.
 *
 * Upstream dosya dark-only yazılmış (`text-white`, `rgba(0,0,0,1)`,
 * `#ffffff1f`) ve parıltı yarıçapını global `--radius` değişkenine yazıyordu;
 * o değişken projenin tasarım token'ı olduğu için (bkz. globals.css) alt
 * elemanlara sızıyordu. DESIGN.md'ye çevrildi: renkler `--primary` /
 * `--primary-foreground` token'larından gelir, yarıçap ayrı bir
 * `--shimmer-radius` değişkeninde tutulur, iç parlama `color-mix` ile
 * türetilir ve `prefers-reduced-motion`'da animasyon durur.
 *
 * Keyframe'ler (`shimmer-slide`, `spin-around`) globals.css `@theme` bloğunda.
 */
export interface ShimmerButtonProps extends ComponentPropsWithoutRef<'button'> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  className?: string;
  children?: React.ReactNode;
}

export const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      shimmerColor = 'var(--primary-foreground)',
      shimmerSize = '0.05em',
      shimmerDuration = '3s',
      borderRadius = 'var(--radius-md)',
      background = 'var(--primary)',
      className,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        style={
          {
            '--spread': '90deg',
            '--shimmer-color': shimmerColor,
            '--shimmer-radius': borderRadius,
            '--speed': shimmerDuration,
            '--cut': shimmerSize,
            '--bg': background,
            '--shimmer-glow': 'color-mix(in oklab, var(--shimmer-color) 12%, transparent)',
            '--shimmer-glow-strong': 'color-mix(in oklab, var(--shimmer-color) 25%, transparent)',
          } as CSSProperties
        }
        className={cn(
          'group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap border border-primary-foreground/10 px-6 py-3 text-primary-foreground [background:var(--bg)] [border-radius:var(--shimmer-radius)]',
          'transform-gpu transition-transform duration-150 ease-in-out active:translate-y-px',
          'disabled:pointer-events-none disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      >
        {/* parıltı kabı */}
        <div className={cn('-z-30 blur-[2px]', '@container-[size] absolute inset-0 overflow-visible')}>
          {/* parıltı */}
          <div className="animate-shimmer-slide absolute inset-0 aspect-[1] h-[100cqh] rounded-none [mask:none] motion-reduce:animate-none">
            {/* parıltının konik gradyanı */}
            <div className="animate-spin-around absolute -inset-full w-auto rotate-0 [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))] [translate:0_0] motion-reduce:animate-none" />
          </div>
        </div>

        {children}

        {/* iç parlama */}
        <div
          className={cn(
            'absolute inset-0 size-full [border-radius:var(--shimmer-radius)]',
            'shadow-[inset_0_-8px_10px_var(--shimmer-glow)]',
            'transform-gpu transition-[box-shadow] duration-150 ease-in-out',
            'group-hover:shadow-[inset_0_-6px_10px_var(--shimmer-glow-strong)]',
            'group-active:shadow-[inset_0_-10px_10px_var(--shimmer-glow-strong)]',
          )}
        />

        {/* zemin — parıltıyı kenarda bırakan iç dolgu */}
        <div className="absolute inset-(--cut) -z-20 [background:var(--bg)] [border-radius:var(--shimmer-radius)]" />
      </button>
    );
  },
);

ShimmerButton.displayName = 'ShimmerButton';
