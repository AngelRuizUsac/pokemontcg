import type { DeckListLine, DeckSection } from "./pokemonLiveFormat";

const API_ROOT = "https://play.limitlesstcg.com/api";
const CACHE_PREFIX = "pokedex-tcg:limitless:";
const CACHE_MS = 15 * 60 * 1000;

export interface LimitlessTournament {
  id: string;
  game: string;
  format: string;
  name: string;
  date: string;
  players: number;
  source?: "official" | "online";
  standings?: LimitlessStanding[];
}

export interface LimitlessStanding {
  player: string;
  name: string;
  country?: string;
  placing: number;
  record?: { wins?: number; losses?: number; ties?: number };
  deck?: { id?: string; name?: string; icons?: string[] } | null;
  decklist?: unknown;
}

async function limitlessFetch<T>(path: string): Promise<T> {
  const cacheKey = `${CACHE_PREFIX}${path}`;
  if (typeof window !== "undefined") {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) ?? "null");
      if (cached && Date.now() - cached.savedAt < CACHE_MS) return cached.data as T;
    } catch {}
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${API_ROOT}${path}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Limitless respondió ${response.status}`);
    const data = await response.json() as T;
    if (typeof window !== "undefined") {
      try { localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data })); } catch {}
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export function getLimitlessTournaments(page = 1, limit = 50) {
  return limitlessFetch<LimitlessTournament[]>(
    `/tournaments?game=PTCG&format=STANDARD&limit=${limit}&page=${page}`
  );
}

export function getLimitlessStandings(tournamentId: string) {
  return limitlessFetch<LimitlessStanding[]>(
    `/tournaments/${encodeURIComponent(tournamentId)}/standings`
  );
}

function sectionFromKey(key: string): DeckSection | null {
  const normalized = key.toLowerCase();
  if (normalized.includes("pokemon") || normalized.includes("pokémon")) return "Pokemon";
  if (normalized.includes("trainer")) return "Trainer";
  if (normalized.includes("energy")) return "Energy";
  return null;
}

// La documentación define decklist como contenido específico del juego. Este
// normalizador acepta tanto el objeto por secciones usado por PTCG como una
// lista plana, sin alterar las cantidades de la lista publicada.
export function normalizeLimitlessDecklist(decklist: unknown): DeckListLine[] {
  const result: DeckListLine[] = [];
  const add = (raw: unknown, section: DeckSection | null) => {
    if (!raw || typeof raw !== "object") return;
    const item = raw as Record<string, unknown>;
    const resolvedSection = section ?? sectionFromKey(String(item.type ?? item.category ?? ""));
    const name = String(item.name ?? item.card ?? "").trim();
    const setCode = String(item.set ?? item.setCode ?? item.expansion ?? "").trim();
    const number = String(item.number ?? item.localId ?? item.cardNumber ?? "").trim();
    const quantity = Number(item.count ?? item.quantity ?? item.qty ?? 0);
    if (resolvedSection && name && quantity > 0) {
      result.push({ section: resolvedSection, name, setCode, number, quantity, imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : undefined });
    }
  };

  if (Array.isArray(decklist)) decklist.forEach((item) => add(item, null));
  else if (decklist && typeof decklist === "object") {
    for (const [key, value] of Object.entries(decklist as Record<string, unknown>)) {
      const section = sectionFromKey(key);
      if (section && Array.isArray(value)) value.forEach((item) => add(item, section));
    }
  }
  return result;
}

export function limitlessTournamentUrl(id: string) {
  if (id.startsWith("official:")) return `https://limitlesstcg.com/tournaments/${encodeURIComponent(id.slice(9))}`;
  return `https://play.limitlesstcg.com/tournament/${encodeURIComponent(id)}/standings`;
}
