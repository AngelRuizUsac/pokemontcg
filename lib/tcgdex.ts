import type { CardBrief, PokemonCard, SetBrief } from "./types";
import { KNOWN_SET_CODES_BY_ID, KNOWN_SET_CODES_BY_NAME, normalizeSetName } from "./knownSetCodes";

// API pública y gratuita, sin llave y sin límite de peticiones publicado
// (https://tcgdex.dev/faq). Se llama directo desde el navegador porque esta
// app es 100% estática (GitHub Pages) y no tiene backend propio.
//
// El dominio principal (api.tcgdex.net) a veces tiene problemas de DNS/CDN;
// la comunidad de TCGdex (Discord) recomienda los hosts regionales como
// respaldo, así que se intentan en orden hasta que uno responda.
const BASE_HOSTS = [
  "https://api.eu1.tcgdex.net/v2/en",
  "https://api.eu2.tcgdex.net/v2/en",
];

async function tcgdexFetch(path: string): Promise<Response> {
  let lastError: unknown = null;
  for (const host of BASE_HOSTS) {
    try {
      const res = await fetch(`${host}${path}`);
      if (res.ok) return res;
      lastError = new Error(`TCGdex respondió ${res.status}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("No se pudo conectar con TCGdex (todos los servidores fallaron).");
}

// Límite de resultados detallados que se piden de golpe en una búsqueda,
// para no disparar cientos de peticiones de "detalle de carta" a la vez.
const MAX_RESULTS = 60;

const PAGE_SIZE = 24;

export async function searchCards(name: string, page = 1): Promise<CardBrief[]> {
  const trimmed = name.trim();
  if (!trimmed) return [];

  const search = new URLSearchParams();
  search.set("name", trimmed);
  search.set("pagination:page", String(page));
  search.set("pagination:itemsPerPage", String(PAGE_SIZE));

  const res = await tcgdexFetch(`/cards?${search.toString()}`);
  return res.json();
}

export async function getCardById(id: string): Promise<PokemonCard> {
  const res = await tcgdexFetch(`/cards/${id}`);
  return res.json();
}

let setsCache: SetBrief[] | null = null;

// Lista de expansiones (para el selector del filtro "buscar por expansión").
// Se cachea en memoria porque no cambia durante la sesión.
export async function listSets(): Promise<SetBrief[]> {
  if (setsCache) return setsCache;
  const res = await tcgdexFetch(`/sets`);
  const sets: SetBrief[] = await res.json();
  sets.sort((a, b) => a.name.localeCompare(b.name));
  setsCache = sets;
  return sets;
}

// Trae una expansión completa con su listado de cartas (id/localId/nombre/imagen).
// Se usa para "buscar por expansión y número" filtrando en el cliente, en vez
// de depender de un filtro anidado (set.id) no documentado en la API REST.
export async function getSetWithCards(
  setId: string
): Promise<{ set: SetBrief; cards: CardBrief[] }> {
  const res = await tcgdexFetch(`/sets/${setId}`);
  const data = await res.json();
  return { set: data, cards: data.cards ?? [] };
}

export interface AdvancedSearchOptions {
  name?: string;
  setId?: string;
  number?: string;
  // letras individuales ya expandidas, ej. ["H","I","J"]
  regulationMarks?: string[];
  page?: number;
}

export interface AdvancedSearchResult {
  briefs: CardBrief[];
  hasMore: boolean;
}

// Búsqueda combinada: por nombre, por expansión+número, y/o por rango de
// regulation mark. Los tres se pueden usar juntos, por separado, o ninguno.
// Cuando la búsqueda es solo por nombre (sin expansión ni regulation mark),
// soporta paginación real con "page" — para casos como Charizard, que tiene
// muchas más de 24 impresiones.
export async function searchCardsAdvanced(
  opts: AdvancedSearchOptions
): Promise<AdvancedSearchResult> {
  const page = opts.page ?? 1;

  if (opts.setId) {
    const { cards } = await getSetWithCards(opts.setId);
    let briefs = cards;
    if (opts.number?.trim()) {
      const num = opts.number.trim().replace(/^0+/, "");
      briefs = briefs.filter(
        (c) => c.localId.replace(/^0+/, "") === num || c.localId === opts.number
      );
    }
    if (opts.name?.trim()) {
      const term = opts.name.trim().toLowerCase();
      briefs = briefs.filter((c) => c.name.toLowerCase().includes(term));
    }
    return { briefs: briefs.slice(0, MAX_RESULTS), hasMore: false };
  }

  if (opts.regulationMarks && opts.regulationMarks.length > 0) {
    const batches = await Promise.all(
      opts.regulationMarks.map(async (mark) => {
        const params = new URLSearchParams();
        if (opts.name?.trim()) params.set("name", opts.name.trim());
        params.set("regulationMark", `eq:${mark}`);
        params.set("pagination:itemsPerPage", "100");
        const res = await tcgdexFetch(`/cards?${params.toString()}`);
        return (await res.json()) as CardBrief[];
      })
    );
    const merged = new Map<string, CardBrief>();
    batches.flat().forEach((c) => merged.set(c.id, c));
    const all = Array.from(merged.values());
    return {
      briefs: all.slice(0, MAX_RESULTS),
      hasMore: all.length > MAX_RESULTS,
    };
  }

  const briefs = await searchCards(opts.name ?? "", page);
  return { briefs, hasMore: briefs.length === PAGE_SIZE };
}

// Expande "D" -> ["D"], o "H".."J" -> ["H","I","J"] para el filtro de
// regulation mark (que en la API solo admite igualdad exacta por letra).
export function expandRegulationMarkRange(from: string, to?: string): string[] {
  const start = from.trim().toUpperCase();
  if (!start) return [];
  if (!to?.trim()) return [start];

  const end = to.trim().toUpperCase();
  const startCode = start.charCodeAt(0);
  const endCode = end.charCodeAt(0);
  if (startCode > endCode) return [start, end].sort();

  const letters: string[] = [];
  for (let code = startCode; code <= endCode; code++) {
    letters.push(String.fromCharCode(code));
  }
  return letters;
}

// Reconstruye la URL final de la imagen de una carta.
// TCGdex devuelve una URL base sin calidad ni extensión, ej:
//   https://assets.tcgdex.net/en/swsh/swsh3/136
// y hay que agregarle "/{quality}.{extension}".
// Resuelve el código de Pokémon TCG Live/Online de un set, en este orden:
// 1) la tabla por id, con varias entradas confirmadas directamente contra
//    respuestas reales de la API (la más confiable),
// 2) la tabla por nombre, para sets que no están en la de ids,
// 3) el campo "abbreviation" de TCGdex (puede venir como string u objeto —
//    se manejan ambos casos),
// 4) el id interno de TCGdex en mayúsculas, como último recurso.
export function resolveSetCode(set: SetBrief): string {
  if (KNOWN_SET_CODES_BY_ID[set.id]) return KNOWN_SET_CODES_BY_ID[set.id];

  const normalized = normalizeSetName(set.name);
  if (KNOWN_SET_CODES_BY_NAME[normalized]) return KNOWN_SET_CODES_BY_NAME[normalized];
  for (const [key, code] of Object.entries(KNOWN_SET_CODES_BY_NAME)) {
    if (normalized.includes(key) || key.includes(normalized)) return code;
  }

  const abbr = set.abbreviation;
  if (typeof abbr === "string" && abbr.trim()) return abbr.trim();
  if (abbr && typeof abbr === "object" && abbr.official?.trim()) {
    return abbr.official.trim();
  }

  return set.id.toUpperCase();
}

// Link de búsqueda en TCGPlayer para una carta. No apunta al producto exacto
// (TCGdex aún no expone ese link de forma confiable por impresión), pero
// lleva directo a los resultados de esa carta en TCGPlayer.
export function buildTcgPlayerSearchUrl(cardName: string, setName?: string): string {
  const query = setName ? `${cardName} ${setName}` : cardName;
  const params = new URLSearchParams({ q: query, productLineName: "pokemon" });
  return `https://www.tcgplayer.com/search/pokemon/product?${params.toString()}`;
}

export function cardImageUrl(
  baseImage: string | undefined,
  quality: "low" | "high" = "low",
  extension: "webp" | "png" | "jpg" = "webp"
): string {
  if (!baseImage) return "";
  return `${baseImage}/${quality}.${extension}`;
}
