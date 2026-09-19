'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronDownIcon } from '@/components/ui/icons/chevron-down';
import { DocumentPlusIcon } from '@/components/ui/icons/document-plus';
import { PlusIcon } from '@/components/ui/icons/plus';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { GooPopover, GooPopoverContent, GooPopoverTrigger } from '@/components/motion/goo-popover';
import { GooMenuItem, GooMenuLabel, GooMenuSeparator } from '@/components/motion/goo-popover/menu';
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
 * "Yeni kural ekle" — goo ile açılan düz menü: boş kural + hazır şablonlar (ad +
 * tek satır açıklama). E-posta aksiyonlu şablon bildirim adresi yoksa pasiftir.
 */
export function NewRuleMenu({ notificationEmail, open, onOpenChange }: NewRuleMenuProps) {
  const router = useRouter();
  const plus = useIconHover();
  const chevron = useIconHover();
  const blank = useIconHover();

  return (
    <GooPopover open={open} onOpenChange={onOpenChange} align="end" dismiss="consume">
      <GooPopoverTrigger>
        <Button
          className="gap-2"
          onMouseEnter={() => {
            plus.hoverProps.onMouseEnter();
            chevron.hoverProps.onMouseEnter();
          }}
          onMouseLeave={() => {
            plus.hoverProps.onMouseLeave();
            chevron.hoverProps.onMouseLeave();
          }}
        >
          <PlusIcon ref={plus.ref} size={12} className="flex shrink-0 [&>svg]:size-3!" aria-hidden />
          Yeni kural ekle
          <ChevronDownIcon ref={chevron.ref} size={12} className="flex shrink-0 opacity-70 [&>svg]:size-3!" aria-hidden />
        </Button>
      </GooPopoverTrigger>
      <GooPopoverContent aria-label="Yeni kural ekle" className="w-72 p-1.5">
        <GooMenuItem onSelect={() => router.push(newRuleHref())} {...blank.hoverProps}>
          <DocumentPlusIcon ref={blank.ref} size={16} className="flex shrink-0" aria-hidden />
          Boş kural
        </GooMenuItem>
        <GooMenuSeparator />
        <GooMenuLabel className={LABEL_CLASS}>Şablonlar</GooMenuLabel>
        {RULE_TEMPLATES.map(template => {
          const needsEmail = hasActionType(template.rule.workflow, 'email') && !notificationEmail;
          return (
            <GooMenuItem
              key={template.key}
              disabled={needsEmail}
              className="flex-col items-start gap-0.5"
              onSelect={() => router.push(newRuleHref(template.key))}
            >
              <span className="text-sm text-foreground">{template.name}</span>
              <span className="text-xs text-muted-foreground">
                {needsEmail ? 'E-posta için Ayarlar’da bildirim adresi gerekli.' : template.description}
              </span>
            </GooMenuItem>
          );
        })}
      </GooPopoverContent>
    </GooPopover>
  );
}
