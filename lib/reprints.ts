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

// Clave de agrupación para la vista de mazos: las cartas Trainer/Energy se
// agrupan solo por nombre; las Pokémon, por nombre + firma de efecto (así
// las reimpresiones con ataques distintos NO se mezclan entre sí).
export function deckGroupKey(entry: CollectionEntry): string {
  if (entry.category === "Pokemon" && entry.effectSignature) {
    return `${entry.cardName}::${entry.effectSignature}`;
  }
  return `${entry.cardName}::name-only`;
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
