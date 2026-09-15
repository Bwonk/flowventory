'use client';

/** Yerinde düzenlenen hücre: dinlenmede düz metin, odakta `bg-muted` + ring. */
export function EditableCell({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (next: string) => void;
}) {
  return (
    <input
      value={value}
      aria-label={label}
      size={1}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      placeholder="—"
      className="-mx-2 w-full min-w-0 appearance-none rounded-sm border-0 bg-transparent px-2 py-1 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/60 focus:bg-muted focus:ring-1 focus:ring-ring"
    />
  );
}
