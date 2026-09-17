'use client';

import { useRouter } from 'next/navigation';
import { ChevronDown, FilePlus2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { hasActionType } from '@/lib/rules/actions-catalog';
import { RULE_TEMPLATES, type RuleTemplateKey } from '@/lib/rules/templates';

interface NewRuleMenuProps {
  notificationEmail: string | null;
  /** Kontrollü açılış (boş durumdaki "İlk kuralı oluştur" bağlantısı için). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Oluşturucu rotası: boş kural ya da şablon anahtarı. */
export function newRuleHref(template?: RuleTemplateKey): string {
  return template ? `/dashboard/kurallar/yeni?template=${template}` : '/dashboard/kurallar/yeni';
}

const LABEL_CLASS = 'font-mono text-[10px] uppercase tracking-wider text-muted-foreground';

/**
 * "Yeni kural ekle" — düz menü: boş kural + hazır şablonlar (ad + tek satır
 * açıklama). E-posta aksiyonlu şablon bildirim adresi yoksa pasiftir.
 */
export function NewRuleMenu({ notificationEmail, open, onOpenChange }: NewRuleMenuProps) {
  const router = useRouter();

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-3" aria-hidden />
          Yeni kural ekle
          <ChevronDown className="size-3 opacity-70" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 rounded-lg border-hairline p-1.5">
        <DropdownMenuItem className="gap-2" onSelect={() => router.push(newRuleHref())}>
          <FilePlus2 className="size-4" aria-hidden />
          Boş kural
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className={LABEL_CLASS}>Şablonlar</DropdownMenuLabel>
        {RULE_TEMPLATES.map(template => {
          const needsEmail = hasActionType(template.rule.workflow, 'email') && !notificationEmail;
          return (
            <DropdownMenuItem
              key={template.key}
              disabled={needsEmail}
              className="flex-col items-start gap-0.5"
              onSelect={() => router.push(newRuleHref(template.key))}
            >
              <span className="text-sm text-foreground">{template.name}</span>
              <span className="text-xs text-muted-foreground">
                {needsEmail ? 'E-posta için Ayarlar’da bildirim adresi gerekli.' : template.description}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
