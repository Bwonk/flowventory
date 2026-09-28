import './globals.css';
import React from 'react';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      {/* Sekme ikonu Next dosya kuralından gelir: app/favicon.ico, icon.svg, apple-icon.png */}
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
