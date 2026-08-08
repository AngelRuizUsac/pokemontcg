// Tipos (parciales) de la respuesta de https://tcgdex.dev
// Solo se incluyen los campos que la app realmente usa.

// Lo que devuelve GET /cards?name=... (listado, sin precio ni set)
export interface CardBrief {
  id: string; // ej. "swsh3-136"
  localId: string; // número dentro del set, ej. "136"
  name: string;
  image?: string; // URL base, sin calidad/extensión (ver cardImageUrl)
}

export interface SetBrief {
  id: string;
  name: string;
  logo?: string;
  symbol?: string;
  cardCount: { total: number; official: number };
  // Código de 2-5 letras que usa Pokémon TCG Live/Online para este set
  // (ej. "TWM", "MEG"). Se usa para exportar/importar listas de mazo.
  // La API puede devolver esto como string simple o como objeto — se
  // manejan ambos casos, ver lib/tcgdex.ts#resolveSetCode.
  abbreviation?: string | { official?: string; unofficial?: Record<string, string> };
}

export interface TcgPlayerVariantPrice {
  lowPrice?: number;
  midPrice?: number;
  highPrice?: number;
  marketPrice?: number;
  directLowPrice?: number;
}

export interface TcgPlayerPricing {
  url?: string; // link a la página de la carta en TCGPlayer
  updated: number;
  unit: string;
  normal?: TcgPlayerVariantPrice;
  holofoil?: TcgPlayerVariantPrice;
  "reverse-holofoil"?: TcgPlayerVariantPrice;
  "1st-edition"?: TcgPlayerVariantPrice;
  "1st-edition-holofoil"?: TcgPlayerVariantPrice;
  unlimited?: TcgPlayerVariantPrice;
  "unlimited-holofoil"?: TcgPlayerVariantPrice;
}

export interface CardMarketPricing {
  updated?: string;
  unit?: string;
  avg?: number;
  low?: number;
  trend?: number;
}

export interface CardPricing {
  tcgplayer?: TcgPlayerPricing;
  cardmarket?: CardMarketPricing;
}

export interface CardAttack {
  cost?: string[];
  name: string;
  effect?: string;
  damage?: number | string;
}

export interface CardAbility {
  type?: string;
  name: string;
  effect?: string;
}

// Lo que devuelve GET /cards/:id (detalle completo, con precio y set)
export interface CardWeakResist {
  type: string;
  value: string;
}

export interface CardLegality {
  standard?: boolean;
  expanded?: boolean;
}

export interface PokemonCard extends CardBrief {
  category: "Pokemon" | "Energy" | "Trainer";
  rarity?: string;
  set: SetBrief;
  pricing?: CardPricing;
  hp?: number;
  types?: string[];
  stage?: string;
  evolveFrom?: string;
  retreat?: number;
  attacks?: CardAttack[];
  abilities?: CardAbility[];
  weaknesses?: CardWeakResist[];
  resistances?: CardWeakResist[];
  regulationMark?: string;
  trainerType?: string; // "Item" | "Supporter" | "Stadium" | "Tool"…
  energyType?: string; // "Basic" | "Special"
  effect?: string; // texto de la carta, para Trainer/Energy especiales
  description?: string; // dex entry / flavor text, cuando existe
  legal?: CardLegality;
  illustrator?: string;
  dexId?: number[];
}

// Orden de preferencia de acabado para resolver "el" precio de mercado a mostrar.
const PREFERRED_VARIANTS: (keyof TcgPlayerPricing)[] = [
  "normal",
  "holofoil",
  "reverse-holofoil",
  "1st-edition-holofoil",
  "1st-edition",
  "unlimited-holofoil",
  "unlimited",
];

// Resuelve un único precio de mercado en USD (TCGPlayer) para mostrar en la UI.
export function resolveMarketPriceUsd(card: PokemonCard): number | null {
  const tcg = card.pricing?.tcgplayer;
  if (!tcg) return null;

  for (const key of PREFERRED_VARIANTS) {
    const variant = tcg[key] as TcgPlayerVariantPrice | undefined;
    if (variant?.marketPrice != null) return variant.marketPrice;
  }
  return null;
}

// Link a la página de la carta en TCGPlayer. TCGdex todavía no expone de
// forma confiable un link directo por impresión (según su propio FAQ, el
// campo con IDs de TCGPlayer/Cardmarket por variante sigue en desarrollo),
// así que en vez de depender de eso se arma un link de búsqueda en
// TCGPlayer con el nombre de la carta — ver lib/tcgdex.ts#buildTcgPlayerSearchUrl.
