import type { PokemonCard } from "./types";
import type { CollectionEntry } from "./storage";

// Calcula una "firma" del efecto de una carta Pokémon (ataques + habilidades
// + stats relevantes). Dos impresiones con la misma firma son, para efectos
// de armar un mazo, la misma carta jugable — aunque vengan de expansiones
// distintas. Si la firma difiere, son versiones distintas aunque compartan
// nombre (pasa con algunos Pokémon reimpresos con otro set de ataques).
//
// Las cartas de Trainer (y, por ahora, Energy) NO necesitan esta firma:
// según las reglas del juego, un Trainer con el mismo nombre siempre tiene
// el mismo efecto sin importar la expansión, así que para esas categorías
// se agrupa solo por nombre.
export function computeEffectSignature(card: PokemonCard): string | null {
  if (card.category !== "Pokemon") return null;

  const attacks = (card.attacks ?? [])
    .map((a) => `${a.name}|${a.cost?.join(",") ?? ""}|${a.damage ?? ""}|${a.effect ?? ""}`)
    .sort();
  const abilities = (card.abilities ?? [])
    .map((a) => `${a.type ?? ""}|${a.name}|${a.effect ?? ""}`)
    .sort();

  return JSON.stringify({
    hp: card.hp ?? null,
    stage: card.stage ?? null,
    types: [...(card.types ?? [])].sort(),
    retreat: card.retreat ?? null,
    attacks,
    abilities,
  });
}

function normalizeSignatureValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .normalize("NFKD")
      .replace(/[’‘`]/g, "'")
      .replace(/×/g, "x")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }
  if (Array.isArray(value)) return value.map(normalizeSignatureValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        normalizeSignatureValue(item),
      ])
    );
  }
  return value;
}

function canonicalEffectSignature(signature: string): string {
  try {
    return JSON.stringify(normalizeSignatureValue(JSON.parse(signature)));
  } catch {
    return signature;
  }
}

export function normalizeCardName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[’‘`]/g, "'")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// TCGdex puede corregir apóstrofos, acentos, espacios o puntuación entre una
// impresión y otra. Esas diferencias editoriales no cambian cómo funciona la
// carta y no deben hacer que aparezca como una compra pendiente.
export function effectSignaturesMatch(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  if (!left || !right) return false;
  if (left === right) return true;
  return canonicalEffectSignature(left) === canonicalEffectSignature(right);
}

export function reprintGroupKey(
  cardName: string,
  category: CollectionEntry["category"],
  effectSignature?: string | null,
  fallbackCardId = "unknown"
): string {
  const name = normalizeCardName(cardName);
  if (category === "Pokemon") {
    return `${category}:${name}::${effectSignature ? canonicalEffectSignature(effectSignature) : fallbackCardId}`;
  }
  return `${category}:${name}::name-only`;
}

// Clave de agrupación para la vista de mazos: las cartas Trainer/Energy se
// agrupan solo por nombre; las Pokémon, por nombre + firma de efecto (así
// las reimpresiones con ataques distintos NO se mezclan entre sí).
export function deckGroupKey(entry: CollectionEntry): string {
  return reprintGroupKey(entry.cardName, entry.category, entry.effectSignature, entry.cardId);
}

export interface DeckReprintGroup {
  key: string;
  cardName: string;
  category: CollectionEntry["category"];
  entries: CollectionEntry[]; // las impresiones (distintos sets) que caen en este grupo
  totalOwned: number;
  totalAvailable: number;
}

// Agrupa entradas de la colección para mostrarlas en el contexto de un mazo:
// combina reimpresiones jugablemente idénticas en una sola fila.
// `getAvailable` resuelve cuánto de cada entrada sigue sin asignar a un
// binder/mazo (se inyecta para no crear una dependencia circular con storage.ts).
export function groupEntriesForDeckView(
  entries: CollectionEntry[],
  getAvailable: (entryId: string) => number
): DeckReprintGroup[] {
  const groups = new Map<string, DeckReprintGroup>();

  for (const entry of entries) {
    const key = deckGroupKey(entry);
    const available = getAvailable(entry.id);
    const existing = groups.get(key);
    if (existing) {
      existing.entries.push(entry);
      existing.totalOwned += entry.quantity;
      existing.totalAvailable += available;
    } else {
      groups.set(key, {
        key,
        cardName: entry.cardName,
        category: entry.category,
        entries: [entry],
        totalOwned: entry.quantity,
        totalAvailable: available,
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.cardName.localeCompare(b.cardName)
  );
}

// Para binders NO se agrupa nunca: cada impresión (set/condición/idioma) se
// muestra por separado, porque el binder es inventario real para vender.
export function groupEntriesForBinderView(
  entries: CollectionEntry[]
): CollectionEntry[] {
  return [...entries].sort((a, b) => a.cardName.localeCompare(b.cardName));
}
