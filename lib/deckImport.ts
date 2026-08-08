import { listSets, getSetWithCards, getCardById, resolveSetCode, searchCards } from "./tcgdex";
import type { DeckListLine } from "./pokemonLiveFormat";
import type { PokemonCard } from "./types";

export interface MatchedDeckLine {
  line: DeckListLine;
  card: PokemonCard;
}

export interface DeckImportResult {
  matched: MatchedDeckLine[];
  unmatched: DeckListLine[];
}

// Por cada línea "4 Dreepy TWM 128": busca el set cuyo código PTCGO/Live sea
// "TWM", y dentro de ese set la carta con número local "128".
//
// Caso especial: las líneas de la sección "Energy:" no necesitan coincidir
// en número/set — con el nombre alcanza (una Fire Energy es igual sin
// importar de qué set venga), así que esas se buscan solo por nombre.
export async function matchDeckListLines(
  lines: DeckListLine[]
): Promise<DeckImportResult> {
  const sets = await listSets();
  const matched: MatchedDeckLine[] = [];
  const unmatched: DeckListLine[] = [];

  const setCache = new Map<string, Awaited<ReturnType<typeof getSetWithCards>>>();

  for (const line of lines) {
    if (line.section === "Energy") {
      try {
        const briefs = await searchCards(line.name);
        if (briefs.length === 0) {
          unmatched.push(line);
          continue;
        }
        // trae el detalle de las primeras coincidencias y prefiere la que
        // tenga el mismo código de set que la línea importada; si ninguna
        // coincide, usa la primera con el nombre exacto.
        const candidates = await Promise.all(
          briefs.slice(0, 6).map((b) => getCardById(b.id))
        );
        const byCode = candidates.find(
          (c) => resolveSetCode(c.set).toUpperCase() === line.setCode.toUpperCase()
        );
        const byName = candidates.find(
          (c) => c.name.toLowerCase() === line.name.toLowerCase()
        );
        const card = byCode ?? byName ?? candidates[0];
        matched.push({ line, card });
      } catch {
        unmatched.push(line);
      }
      continue;
    }

    const set = sets.find(
      (s) => resolveSetCode(s).toUpperCase() === line.setCode.toUpperCase()
    );
    if (!set) {
      unmatched.push(line);
      continue;
    }

    try {
      let setData = setCache.get(set.id);
      if (!setData) {
        setData = await getSetWithCards(set.id);
        setCache.set(set.id, setData);
      }
      const num = line.number.replace(/^0+/, "");
      const brief = setData.cards.find(
        (c) => c.localId === line.number || c.localId.replace(/^0+/, "") === num
      );
      if (!brief) {
        unmatched.push(line);
        continue;
      }
      const card = await getCardById(brief.id);
      matched.push({ line, card });
    } catch {
      unmatched.push(line);
    }
  }

  return { matched, unmatched };
}
