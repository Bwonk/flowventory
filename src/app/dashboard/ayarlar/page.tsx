'use client';

import { TrackingScriptCard } from './_components/TrackingScriptCard';

export default function AyarlarPage() {
  return (
    <div className="p-8">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-slate">YAPILANDIRMA</p>
      <h1 className="mb-8 text-4xl font-normal tracking-[-0.04em] text-primary">Ayarlar</h1>
      <TrackingScriptCard />
    </div>
  );
}
