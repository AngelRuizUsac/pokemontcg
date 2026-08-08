import type { Allocation, CollectionEntry, WorkSlot, AppSettings, CardCategory } from "./storage";
import { expandRegulationMarkRange, searchCards, getCardById } from "./tcgdex";

interface Row {
  entry: CollectionEntry;
  alloc: Allocation;
}

export interface CopyViolation {
  name: string;
  count: number;
}

export interface RegulationViolation {
  name: string;
  mark: string;
  category: CardCategory;
}

export interface DeckLegalityResult {
  totalCards: number;
  countOk: boolean; // exactamente 60
  copyViolations: CopyViolation[]; // más de 4 copias del mismo nombre (energía básica exenta)
  regulationViolations: RegulationViolation[]; // fuera del rango Standard configurado
  regulationChecked: boolean; // false si no se configuró ningún rango en Ajustes
}

// Reglas estándar de Pokémon TCG: exactamente 60 cartas, máximo 4 copias de
// cualquier carta con el mismo nombre (la energía básica no tiene límite), y
// —si el jugador configuró un rango en Ajustes— todas las cartas deben caer
// dentro de las regulation marks legales para el formato Standard vigente.
//
// Esta primera pasada es rápida (no llama a la API): solo revisa la marca de
// la copia que el jugador tiene/eligió. Para Trainer y Energy hay una regla
// oficial extra — si esa carta tiene AL MENOS UNA reimpresión con marca
// vigente, es legal sin importar qué copia física tengas — que se revisa
// aparte con refineRegulationViolations, porque necesita consultar TCGdex.
export function checkDeckLegality(
  rows: Row[],
  workSlots: WorkSlot[],
  settings: AppSettings
): DeckLegalityResult {
  const nameQty = new Map<string, number>();
  const basicEnergyNames = new Set<string>();
  const regulationViolations: RegulationViolation[] = [];

  const standardMarks =
    settings.standardMarkFrom.trim().length > 0
      ? expandRegulationMarkRange(settings.standardMarkFrom, settings.standardMarkTo || undefined)
      : [];

  function record(
    name: string,
    qty: number,
    category: CardCategory,
    energyType: string | null,
    mark: string | null
  ) {
    nameQty.set(name, (nameQty.get(name) ?? 0) + qty);
    if (category === "Energy" && energyType === "Basic") basicEnergyNames.add(name);
    if (standardMarks.length > 0 && mark && !standardMarks.includes(mark.toUpperCase())) {
      regulationViolations.push({ name, mark, category });
    }
  }

  for (const r of rows) {
    record(r.entry.cardName, r.alloc.quantity, r.entry.category, r.entry.energyType, r.entry.regulationMark);
  }
  for (const w of workSlots) {
    if (w.isGeneric) continue; // energía básica genérica: sin restricción de formato
    record(w.cardName, w.quantity, w.category, w.energyType, w.regulationMark);
  }

  const totalCards =
    Array.from(nameQty.values()).reduce((a, b) => a + b, 0) +
    workSlots.filter((w) => w.isGeneric).reduce((a, w) => a + w.quantity, 0);

  const copyViolations = Array.from(nameQty.entries())
    .filter(([name, qty]) => !basicEnergyNames.has(name) && qty > 4)
    .map(([name, count]) => ({ name, count }));

  return {
    totalCards,
    countOk: totalCards === 60,
    copyViolations,
    regulationViolations,
    regulationChecked: standardMarks.length > 0,
  };
}

// Busca, para una carta Trainer/Energy, si existe alguna reimpresión (de
// cualquier expansión) con una regulation mark dentro del rango Standard
// configurado. Trainer y Energy siempre mantienen el mismo efecto entre
// reimpresiones, así que si existe una versión vigente, la carta es legal
// sin importar cuál copia física tengas. Los Pokémon quedan fuera de esta
// excepción a propósito: una reimpresión puede traer ataques distintos, así
// que no se puede asumir que cualquier copia sirve igual.
async function hasLegalReprint(cardName: string, standardMarks: string[]): Promise<boolean> {
  try {
    const briefs = await searchCards(cardName);
    const sameName = briefs.filter((b) => b.name.toLowerCase() === cardName.toLowerCase());
    const candidates = (sameName.length > 0 ? sameName : briefs).slice(0, 15);
    const details = await Promise.all(candidates.map((b) => getCardById(b.id)));
    return details.some(
      (c) => c.regulationMark && standardMarks.includes(c.regulationMark.toUpperCase())
    );
  } catch {
    return false;
  }
}

// Segunda pasada (async): de las violaciones de regulation mark que ya
// encontró checkDeckLegality, quita las Trainer/Energy que sí tienen una
// reimpresión vigente en algún set.
export async function refineRegulationViolations(
  violations: RegulationViolation[],
  settings: AppSettings
): Promise<RegulationViolation[]> {
  const standardMarks =
    settings.standardMarkFrom.trim().length > 0
      ? expandRegulationMarkRange(settings.standardMarkFrom, settings.standardMarkTo || undefined)
      : [];
  if (standardMarks.length === 0) return violations;

  const uniqueNames = Array.from(
    new Set(
      violations.filter((v) => v.category === "Trainer" || v.category === "Energy").map((v) => v.name)
    )
  );

  const legalByName = new Map<string, boolean>();
  await Promise.all(
    uniqueNames.map(async (name) => {
      legalByName.set(name, await hasLegalReprint(name, standardMarks));
    })
  );

  return violations.filter((v) => {
    if (v.category !== "Trainer" && v.category !== "Energy") return true;
    return !legalByName.get(v.name);
  });
}
