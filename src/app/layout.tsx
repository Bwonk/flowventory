import './globals.css';
import React from 'react';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { KancaVitals } from '@kanca-app/ikas/react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      {/* Sekme ikonu Next dosya kuralından gelir: app/favicon.ico, icon.svg, apple-icon.png */}
      <body className="antialiased" suppressHydrationWarning>
        <KancaVitals publicKey={process.env.NEXT_PUBLIC_KANCA_PUBLIC_KEY} />
        {children}
      </body>
    </html>
  );
}
