'use client';

import { useRouter } from 'next/navigation';
import { Bell, ChevronDown, Mail, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DOMAIN_LABELS, RULE_DOMAINS, type RuleChannel, type RuleDomain } from '@/lib/rules/types';

interface NewRuleMenuProps {
  notificationEmail: string | null;
  /** Kontrollü açılış (boş durumdaki "İlk kuralı oluştur" bağlantısı için). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Oluşturucu rotası: kanal + alan sorgu parametresiyle gider. */
export function newRuleHref(channel: RuleChannel, domain: RuleDomain): string {
  return `/dashboard/kurallar/yeni?channel=${channel}&domain=${domain}`;
}

/**
 * "Yeni kural ekle" — iki adımlı alt menü: önce kural tipi (Bildirim /
 * E-posta), sonra alan (Stok Takibi / Satın Alma / Analiz). Seçim
 * oluşturucuya yönlendirir; e-posta tipi bildirim adresi yoksa pasiftir.
 */
export function NewRuleMenu({ notificationEmail, open, onOpenChange }: NewRuleMenuProps) {
  const router = useRouter();
  const go = (channel: RuleChannel, domain: RuleDomain) => router.push(newRuleHref(channel, domain));

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-3" aria-hidden />
          Yeni kural ekle
          <ChevronDown className="size-3 opacity-70" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px] rounded-lg border-hairline p-1.5">
        <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Kural tipi
        </DropdownMenuLabel>
        <DomainSub channel="notification" icon={<Bell className="size-4" aria-hidden />} label="Bildirim" onPick={go} />
        <DomainSub
          channel="email"
          icon={<Mail className="size-4" aria-hidden />}
          label="E-posta"
          disabled={!notificationEmail}
          onPick={go}
        />
        {!notificationEmail && (
          <p className="px-2 pb-1 pt-1.5 text-xs text-muted-foreground">
            E-posta kuralı için Ayarlar&apos;da bildirim adresi ayarlayın.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DomainSub({
  channel,
  icon,
  label,
  disabled,
  onPick,
}: {
  channel: RuleChannel;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onPick: (channel: RuleChannel, domain: RuleDomain) => void;
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={disabled} className="gap-2">
        {icon}
        {label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-[180px] rounded-lg border-hairline p-1.5">
        <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Alan
        </DropdownMenuLabel>
        {RULE_DOMAINS.map(domain => (
          <DropdownMenuItem key={domain} onSelect={() => onPick(channel, domain)}>
            {DOMAIN_LABELS[domain]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
