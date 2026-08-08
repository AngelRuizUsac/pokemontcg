// Mapea la rareza textual que devuelve TCGdex a una clase de borde,
// para dar una pista visual rápida sobre qué tan rara es una carta.
export function rarityBorderClass(rarity?: string | null): string {
  if (!rarity) return "border-ink-700";
  const r = rarity.toLowerCase();

  if (r.includes("common")) return "border-ink-600";
  if (r.includes("uncommon")) return "border-grass/50";
  if (r.includes("rare holo") || r.includes("holo rare")) return "border-holo-cyan/60";
  if (r.includes("ultra") || r.includes("secret") || r.includes("hyper"))
    return "border-holo-pink/70";
  if (r.includes("rare")) return "border-gold/60";
  return "border-ink-700";
}

export function isFoilRarity(rarity?: string | null): boolean {
  if (!rarity) return false;
  const r = rarity.toLowerCase();
  return (
    r.includes("holo") ||
    r.includes("ultra") ||
    r.includes("secret") ||
    r.includes("hyper") ||
    r.includes("rainbow")
  );
}
