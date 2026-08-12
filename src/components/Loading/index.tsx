import React from 'react';
import { Loader2 } from 'lucide-react';

function Loading() {
  return (
    <div className="box-border flex h-[100svh] w-full items-center justify-center">
      <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Lütfen bekleyin…
      </div>
    </div>
  );
}

export default Loading;
