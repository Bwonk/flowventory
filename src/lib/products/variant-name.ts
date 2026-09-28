/** Snapshot'taki `variantValuesJson` → "Beyaz · M"; boş/bozuksa null. */
export function parseVariantName(variantValuesJson: string | null): string | null {
  if (!variantValuesJson) return null;
  try {
    const values = JSON.parse(variantValuesJson) as Array<{ variantValueName?: string | null }>;
    const name = values
      .map(v => v.variantValueName)
      .filter((n): n is string => Boolean(n))
      .join(' · ');
    return name || null;
  } catch {
    return null;
  }
}
