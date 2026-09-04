"use client";

import { useEffect, useMemo, useState } from "react";
import LoadingIndicator from "@/components/LoadingIndicator";
import CardImage from "@/components/CardImage";
import {
  getLimitlessStandings,
  getLimitlessTournaments,
  limitlessTournamentUrl,
  normalizeLimitlessDecklist,
} from "@/lib/limitless";
import type { LimitlessStanding, LimitlessTournament } from "@/lib/limitless";
import { matchDeckListLines } from "@/lib/deckImport";
import type { MatchedDeckLine } from "@/lib/deckImport";
import { GENERIC_BASIC_ENERGIES } from "@/lib/genericEnergy";
import {
  addContainer,
  addWorkSlot,
  allocateToContainer,
  createUsedElsewhereLink,
  getAllocations,
  getCollection,
  getContainers,
  getAvailableQuantity,
  getUsedLinks,
} from "@/lib/storage";
import type { CollectionEntry } from "@/lib/storage";
import { cardImageUrl, resolveSetCode } from "@/lib/tcgdex";
import { resolveMarketPriceUsd } from "@/lib/types";
import { computeEffectSignature, effectSignaturesMatch, normalizeCardName } from "@/lib/reprints";

interface SelectedList {
  tournament: LimitlessTournament;
  standing: LimitlessStanding;
}

interface PreviewCard extends MatchedDeckLine {
  owned: number;
  free: number;
}

type BrowserTab = "official" | "online" | "archetypes";
type TournamentSort = "date-desc" | "date-asc";
type ListSort = "placing-asc" | "placing-desc" | "date-desc";
type StandingWithTournament = LimitlessStanding & { _tournament?: LimitlessTournament };
type RawDeckCard = { name?: string; set?: string; number?: string; count?: number };

interface ArchetypeSummary {
  name: string;
  rows: StandingWithTournament[];
  points: number;
  rank: number;
  share: number;
  mainCard?: RawDeckCard;
}

interface LimitlessArchetypeRank { rank: number; name: string; annotation?: string; points: number; share: number }

function archetypeKey(value: string) {
  return normalizeCardName(value).replace(/\b(ex|mega)\b/g, "").trim();
}

function representativeCard(row?: LimitlessStanding): RawDeckCard | undefined {
  if (!row) return undefined;
  const pokemon = ((row.decklist as { pokemon?: RawDeckCard[] } | null)?.pokemon ?? []);
  const archetype = normalizeCardName(row.deck?.name ?? "").replace(/\b(ex|mega)\b/g, "").trim();
  return pokemon.find((card) => archetype.includes(normalizeCardName(card.name ?? "").replace(/\b(ex|mega)\b/g, "").trim()))
    ?? pokemon.find((card) => /\bex\b/i.test(card.name ?? ""))
    ?? pokemon[0];
}

function matchesEntry(item: MatchedDeckLine, entry: CollectionEntry) {
  const { card } = item;
  if (entry.category !== card.category || normalizeCardName(entry.cardName) !== normalizeCardName(card.name)) return false;
  if (card.category !== "Pokemon") return true;
  return entry.cardId === card.id || effectSignaturesMatch(computeEffectSignature(card), entry.effectSignature);
}

export default function MetajuegoPage() {
  const [tournaments, setTournaments] = useState<LimitlessTournament[]>([]);
  const [officialTournaments, setOfficialTournaments] = useState<LimitlessTournament[]>([]);
  const [officialArchetypes, setOfficialArchetypes] = useState<LimitlessArchetypeRank[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<LimitlessTournament | null>(null);
  const [standings, setStandings] = useState<LimitlessStanding[]>([]);
  const [query, setQuery] = useState("");
  const [eventQuery, setEventQuery] = useState("");
  const [archetypeImages, setArchetypeImages] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<SelectedList | null>(null);
  const [preview, setPreview] = useState<PreviewCard[]>([]);
  const [unmatched, setUnmatched] = useState<{ label: string; quantity: number }[]>([]);
  const [busy, setBusy] = useState<"tournaments" | "standings" | "search" | "preview" | "import" | null>("tournaments");
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<BrowserTab>("official");
  const [tournamentSort, setTournamentSort] = useState<TournamentSort>("date-desc");
  const [listSort, setListSort] = useState<ListSort>("placing-asc");

  useEffect(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    Promise.all([
      getLimitlessTournaments(),
      fetch(`${basePath}/data/limitless-official.json`).then((response) => response.ok ? response.json() : Promise.reject()).catch(() => ({ tournaments: [], archetypes: [] })),
    ])
      .then(([online, official]) => { setTournaments(online.map((item) => ({ ...item, source: "online" }))); setOfficialTournaments((official.tournaments ?? []).map((item: LimitlessTournament) => ({ ...item, id: `official:${item.id}`, source: "official" as const }))); setOfficialArchetypes(official.archetypes ?? []); })
      .catch(() => setMessage("No se pudieron consultar los torneos de Limitless."))
      .finally(() => setBusy(null));
  }, []);

  async function openTournament(tournament: LimitlessTournament) {
    setBusy("standings");
    setMessage(null);
    setSelectedTournament(tournament);
    setSelected(null);
    try {
      const rows = tournament.source === "official" ? (tournament.standings ?? []) : await getLimitlessStandings(tournament.id);
      setStandings(rows.filter((row) => !!row.decklist));
    } catch {
      setStandings([]);
      setMessage("Este torneo no tiene listas públicas o Limitless no respondió.");
    } finally { setBusy(null); }
  }

  async function searchArchetype() {
    const term = query.trim().toLowerCase();
    if (!term) return;
    setBusy("search");
    setMessage(null);
    const found: LimitlessStanding[] = [];
    try {
      for (const tournament of officialTournaments) {
        for (const row of tournament.standings ?? []) {
          if (row.decklist && (row.deck?.name ?? "").toLowerCase().includes(term)) {
            (row as StandingWithTournament)._tournament = tournament;
            found.push(row);
          }
        }
      }
      // Ocho torneos mantienen la consulta dentro del límite público y la
      // caché evita repetir descargas durante quince minutos.
      for (let index = 0; index < Math.min(tournaments.length, 8); index += 2) {
        const batch = tournaments.slice(index, index + 2);
        const responses = await Promise.all(batch.map(async (tournament) => ({
          tournament,
          rows: await getLimitlessStandings(tournament.id),
        })));
        for (const response of responses) {
          for (const row of response.rows) {
            if (row.decklist && (row.deck?.name ?? "").toLowerCase().includes(term)) {
              (row as LimitlessStanding & { _tournament?: LimitlessTournament })._tournament = response.tournament;
              found.push(row);
            }
          }
        }
      }
      setSelectedTournament(null);
      setStandings(found);
      setTab("archetypes");
      if (!found.length) setMessage("No encontré listas de ese arquetipo en los torneos recientes.");
    } catch {
      setMessage("La búsqueda se detuvo por el límite o por un problema de conexión con Limitless.");
    } finally { setBusy(null); }
  }

  async function chooseList(standing: LimitlessStanding) {
    const tournament = selectedTournament ?? (standing as LimitlessStanding & { _tournament?: LimitlessTournament })._tournament;
    if (!tournament) return;
    const lines = normalizeLimitlessDecklist(standing.decklist);
    setSelected({ tournament, standing });
    setPreview([]);
    setUnmatched([]);
    if (!lines.length) {
      setMessage("Limitless entregó esta lista en un formato que todavía no se puede interpretar.");
      return;
    }
    setBusy("preview");
    setMessage(null);
    try {
      const genericNames = new Set(GENERIC_BASIC_ENERGIES.map((energy) => normalizeCardName(energy.name)));
      const generic = lines.filter((line) => line.section === "Energy" && genericNames.has(normalizeCardName(line.name)));
      const result = await matchDeckListLines(lines.filter((line) => !generic.includes(line)));
      const collection = getCollection();
      setPreview(result.matched.map((item) => {
        const entries = collection.filter((entry) => matchesEntry(item, entry));
        return {
          ...item,
          owned: entries.reduce((sum, entry) => sum + entry.quantity, 0),
          free: entries.reduce((sum, entry) => sum + getAvailableQuantity(entry.id), 0),
        };
      }));
      setUnmatched(result.unmatched.map((line) => ({
        label: `${line.quantity} ${line.name} ${line.setCode} ${line.number}`.trim(),
        quantity: line.quantity,
      })));
      for (const line of generic) {
        setPreview((current) => [...current, {
          line,
          card: null as never,
          owned: line.quantity,
          free: line.quantity,
        }]);
      }
    } catch {
      setMessage("No se pudieron resolver todas las cartas con TCGdex.");
    } finally { setBusy(null); }
  }

  async function importSelected() {
    if (!selected) return;
    setBusy("import");
    setMessage(null);
    try {
      const priorities = getContainers().filter((item) => item.type === "deck").map((item) => item.priority);
      const deck = addContainer({
        type: "deck",
        name: `${selected.standing.deck?.name ?? "Mazo Limitless"} · ${selected.standing.name}`,
        image: { kind: "icon", icon: "deck" },
        workMode: true,
        utilityForDecks: false,
        priority: priorities.length ? Math.max(...priorities) + 1 : 0,
      });

      for (const item of preview) {
        const generic = GENERIC_BASIC_ENERGIES.find((energy) => normalizeCardName(energy.name) === normalizeCardName(item.line.name));
        if (generic) {
          addWorkSlot({ deckId: deck.id, cardId: generic.id, cardName: generic.name, category: "Energy", trainerType: null, energyType: "Basic", setId: "", setName: "Energía básica genérica", setAbbreviation: null, number: "", regulationMark: null, imageUrl: "", quantity: item.line.quantity, priceUsd: 0, isGeneric: true, effectSignature: null });
          continue;
        }
        const candidates = getCollection().filter((entry) => matchesEntry(item, entry));
        let remaining = item.line.quantity;
        for (const entry of candidates) {
          const take = Math.min(remaining, getAvailableQuantity(entry.id));
          if (take > 0) { allocateToContainer(deck.id, entry.id, take); remaining -= take; }
        }
        if (remaining > 0) {
          const allocations = getAllocations().filter((allocation) =>
            candidates.some((entry) => entry.id === allocation.collectionEntryId) && allocation.containerId !== deck.id
          );
          for (const allocation of allocations) {
            if (remaining <= 0) break;
            const reserved = getUsedLinks().filter((link) => link.holdingContainerId === allocation.containerId && link.collectionEntryId === allocation.collectionEntryId).reduce((sum, link) => sum + link.quantity, 0);
            const take = Math.min(remaining, Math.max(0, allocation.quantity - reserved));
            if (take > 0) { createUsedElsewhereLink(deck.id, allocation.containerId, allocation.collectionEntryId, take); remaining -= take; }
          }
        }
        if (remaining > 0) {
          const card = item.card;
          addWorkSlot({ deckId: deck.id, cardId: card.id, cardName: card.name, category: card.category, trainerType: card.trainerType ?? null, energyType: card.energyType ?? null, setId: card.set.id, setName: card.set.name, setAbbreviation: resolveSetCode(card.set), number: card.localId, regulationMark: card.regulationMark ?? null, imageUrl: cardImageUrl(card.image, "low", "webp"), quantity: remaining, priceUsd: resolveMarketPriceUsd(card), isGeneric: false, effectSignature: computeEffectSignature(card) });
        }
      }
      setMessage(`Se importó la lista exacta como “${deck.name}”. ${unmatched.length ? `${unmatched.length} carta(s) no pudieron resolverse.` : ""}`);
    } finally { setBusy(null); }
  }

  const totals = useMemo(() => {
    const required = preview.reduce((sum, item) => sum + item.line.quantity, 0) +
      unmatched.reduce((sum, item) => sum + item.quantity, 0);
    const owned = preview.reduce((sum, item) => sum + Math.min(item.line.quantity, item.owned), 0);
    return { required, owned, percentage: required ? Math.round(owned / required * 100) : 0 };
  }, [preview, unmatched]);

  const visibleStandings = standings.filter((row) =>
    !query.trim() || selectedTournament === null || `${row.deck?.name ?? ""} ${row.name}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  const visibleTournaments = [...(tab === "official" ? officialTournaments : tournaments)]
    .filter((item) => `${item.name} ${item.format}`.toLowerCase().includes(eventQuery.trim().toLowerCase()))
    .sort((left, right) => tournamentSort === "date-desc"
      ? Date.parse(right.date) - Date.parse(left.date)
      : Date.parse(left.date) - Date.parse(right.date));

  const sortedStandings = [...visibleStandings].sort((left, right) => {
    if (listSort === "placing-desc") return right.placing - left.placing;
    if (listSort === "date-desc") {
      const leftDate = (left as StandingWithTournament)._tournament?.date ?? selectedTournament?.date ?? "";
      const rightDate = (right as StandingWithTournament)._tournament?.date ?? selectedTournament?.date ?? "";
      return Date.parse(rightDate) - Date.parse(leftDate);
    }
    return left.placing - right.placing;
  });

  const archetypeGroups = Array.from(sortedStandings.reduce((groups, row) => {
    const name = row.deck?.name ?? "Arquetipo sin identificar";
    groups.set(name, [...(groups.get(name) ?? []), row]);
    return groups;
  }, new Map<string, LimitlessStanding[]>()).entries()).sort(([left], [right]) => left.localeCompare(right));

  const archetypeSummaries = useMemo<ArchetypeSummary[]>(() => {
    const groups = new Map<string, StandingWithTournament[]>();
    for (const tournament of officialTournaments) {
      for (const standing of tournament.standings ?? []) {
        if (!standing.decklist) continue;
        const row = standing as StandingWithTournament;
        row._tournament = tournament;
        const name = standing.deck?.name ?? "Arquetipo sin identificar";
        groups.set(name, [...(groups.get(name) ?? []), row]);
      }
    }
    const used = new Set<string>();
    const ranked = officialArchetypes.map((ranking) => {
      const key = archetypeKey(ranking.name);
      const matching = Array.from(groups.entries()).filter(([name]) => archetypeKey(name) === key || archetypeKey(name).includes(key) || key.includes(archetypeKey(name)));
      const rows = matching.flatMap(([, groupRows]) => groupRows);
      matching.forEach(([name]) => used.add(name));
      return { name: `${ranking.name}${ranking.annotation ? ` ${ranking.annotation}` : ""}`, rows, points: ranking.points, rank: ranking.rank, share: ranking.share, mainCard: representativeCard(rows[0]) };
    });
    const unranked = Array.from(groups, ([name, rows]) => ({ name, rows, points: 0, rank: 999, share: 0, mainCard: representativeCard(rows[0]) })).filter((summary) => !used.has(summary.name));
    return [...ranked, ...unranked].sort((left, right) => left.rank - right.rank || right.rows.length - left.rows.length || left.name.localeCompare(right.name));
  }, [officialArchetypes, officialTournaments]);

  useEffect(() => {
    const cards = archetypeSummaries.slice(0, 30).flatMap((summary) => summary.mainCard ? [{
      section: "Pokemon" as const,
      name: summary.mainCard.name ?? "",
      setCode: summary.mainCard.set ?? "",
      number: summary.mainCard.number ?? "",
      quantity: 1,
    }] : []);
    if (!cards.length) return;
    let active = true;
    matchDeckListLines(cards).then((result) => {
      if (!active) return;
      setArchetypeImages(Object.fromEntries(result.matched.map((item) => [normalizeCardName(item.line.name), cardImageUrl(item.card.image, "low", "webp")])));
    }).catch(() => {});
    return () => { active = false; };
  }, [archetypeSummaries]);

  function changeTab(next: BrowserTab) {
    setTab(next);
    setSelected(null);
    setSelectedTournament(null);
    setStandings([]);
    setMessage(null);
  }

  function openArchetype(summary: ArchetypeSummary) {
    setQuery(summary.name);
    setSelectedTournament(null);
    setStandings(summary.rows);
    setMessage(null);
  }

  return <div>
    <h1 className="font-display text-2xl font-bold">Metajuego de Limitless</h1>
    <p className="mt-1 text-sm text-ink-400">Elige una lista real publicada por un jugador; la aplicación nunca genera una lista promedio.</p>

    <div className="mt-5 flex flex-wrap gap-2 border-b border-ink-700 pb-3">
      {([[
        "official", "Torneos oficiales"
      ], ["online", "Online Limitless"], ["archetypes", "Por arquetipos"]] as [BrowserTab, string][]).map(([value, label]) => (
        <button key={value} onClick={() => changeTab(value)} className={`rounded-full px-4 py-2 text-sm ${tab === value ? "bg-gold text-ink-900" : "bg-ink-800 text-ink-300"}`}>{label}</button>
      ))}
    </div>

    {tab === "archetypes" && <div className="mt-5 flex flex-wrap gap-2">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar arquetipo, por ejemplo Dragapult" className="min-w-[260px] flex-1 rounded-full border border-ink-700 bg-ink-800 px-4 py-2 text-sm" />
      <button onClick={searchArchetype} disabled={!!busy || !query.trim()} className="rounded-full bg-gold px-4 py-2 text-sm font-medium text-ink-900 disabled:opacity-40">Buscar arquetipo</button>
    </div>}
    {message && <p className="mt-3 text-xs text-holo-cyan">{message}</p>}
    {busy && <LoadingIndicator label={busy === "tournaments" ? "Consultando torneos…" : busy === "preview" ? "Comparando con tu colección…" : "Consultando Limitless…"} />}

    {!busy && !selected && standings.length === 0 && tab !== "archetypes" && <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-display text-lg font-semibold">{tab === "official" ? "Torneos oficiales" : "Torneos online de Limitless"}</h2>{tab === "official" && <p className="mt-1 text-xs text-ink-400">Worlds, Regionales, Internacionales, Special Events y Championships.</p>}</div>
        <select value={tournamentSort} onChange={(event) => setTournamentSort(event.target.value as TournamentSort)} className="rounded border border-ink-700 bg-ink-800 px-2 py-1.5 text-xs"><option value="date-desc">Fecha: más recientes</option><option value="date-asc">Fecha: más antiguos</option></select>
      </div>
      <input value={eventQuery} onChange={(event) => setEventQuery(event.target.value)} placeholder="Buscar evento por nombre o formato" className="mt-3 w-full rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm" />
      {visibleTournaments.length === 0 ? <p className="mt-4 text-sm text-ink-400">No hay torneos de esta categoría en los resultados recientes.</p> : <div className="mt-3 grid gap-3 sm:grid-cols-2">{visibleTournaments.map((tournament) =>
        <button key={tournament.id} onClick={() => openTournament(tournament)} className="rounded-card border border-ink-700 bg-ink-800 p-4 text-left hover:border-gold/50">
          <p className="font-medium">{tournament.name}</p>
          <p className="mt-1 text-xs text-ink-400">{new Date(tournament.date).toLocaleDateString("es-GT")} · {tournament.players} jugadores · {tournament.format}</p>
        </button>)}
      </div>}
    </section>}

    {!busy && !selected && standings.length === 0 && tab === "archetypes" && <section className="mt-8">
      <div className="grid grid-cols-[3rem_4rem_minmax(0,1fr)_5rem_5rem] items-center border-b border-ink-600 px-3 py-2 text-xs text-ink-400"><span>#</span><span>Carta</span><span>Arquetipo</span><span>Puntos</span><span>Uso</span></div>
      {archetypeSummaries.filter((summary) => summary.name.toLowerCase().includes(query.trim().toLowerCase())).map((summary, index) => {
        const imageUrl = summary.mainCard ? archetypeImages[normalizeCardName(summary.mainCard.name ?? "")] : "";
        return <button key={summary.name} onClick={() => openArchetype(summary)} disabled={!summary.rows.length} className="grid w-full grid-cols-[3rem_4rem_minmax(0,1fr)_5rem_5rem] items-center border-b border-ink-800 px-3 py-2 text-left hover:bg-ink-800 disabled:cursor-default disabled:opacity-60"><span className="font-mono text-gold">{summary.rank < 999 ? summary.rank : index + 1}</span><span className="relative h-14 w-10 overflow-hidden rounded bg-ink-900">{imageUrl ? <CardImage src={imageUrl} alt={summary.mainCard?.name ?? summary.name} className="object-contain" sizes="40px" /> : null}</span><span className="truncate font-medium">{summary.name}<span className="ml-2 text-xs font-normal text-ink-400">{summary.mainCard?.name}</span></span><span className="text-sm text-ink-300">{summary.points || "—"}</span><span className="text-sm text-ink-300">{summary.share ? `${summary.share.toFixed(2)}%` : "—"}</span></button>;
      })}
    </section>}

    {!busy && !selected && standings.length > 0 && <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-lg font-semibold">{selectedTournament?.name ?? `Resultados para “${query}”`}</h2><div className="flex items-center gap-2"><select value={listSort} onChange={(event) => setListSort(event.target.value as ListSort)} className="rounded border border-ink-700 bg-ink-800 px-2 py-1.5 text-xs"><option value="placing-asc">Mejor posición</option><option value="placing-desc">Peor posición</option>{tab === "archetypes" && <option value="date-desc">Fecha más reciente</option>}</select><button onClick={() => { setStandings([]); setSelectedTournament(null); }} className="text-xs text-ink-400">Volver</button></div></div>
      {tab === "archetypes" ? <div className="mt-3 flex flex-col gap-3">{archetypeGroups.map(([name, rows]) => <details key={name} open className="rounded-card border border-ink-700 bg-ink-800"><summary className="cursor-pointer p-3 font-medium">{name} <span className="text-xs text-ink-400">· {rows.length} listas</span></summary><div className="flex flex-col gap-2 border-t border-ink-700 p-3">{rows.map((row) => <button key={`${row.player}-${row.placing}-${(row as StandingWithTournament)._tournament?.id}`} onClick={() => chooseList(row)} className="flex items-center gap-3 rounded-lg bg-ink-900 p-3 text-left hover:ring-1 hover:ring-gold/50"><span className="w-12 font-mono text-gold">#{row.placing}</span><span className="min-w-0 flex-1"><span className="block text-sm">{row.name}</span><span className="block truncate text-xs text-ink-400">{(row as StandingWithTournament)._tournament?.name} · {new Date((row as StandingWithTournament)._tournament?.date ?? "").toLocaleDateString("es-GT")}</span></span></button>)}</div></details>)}</div> :
      <div className="mt-3 flex flex-col gap-2">{sortedStandings.map((row) =>
        <button key={`${row.player}-${row.placing}`} onClick={() => chooseList(row)} className="flex items-center gap-3 rounded-lg border border-ink-700 bg-ink-800 p-3 text-left hover:border-gold/50">
          <span className="w-12 font-mono text-gold">#{row.placing}</span><span className="min-w-0 flex-1"><span className="block font-medium">{row.deck?.name ?? "Arquetipo sin identificar"}</span><span className="block truncate text-xs text-ink-400">{row.name} · {row.record?.wins ?? 0}-{row.record?.losses ?? 0}-{row.record?.ties ?? 0}</span></span>
        </button>)}
      </div>}
    </section>}

    {!busy && selected && <section className="mt-8">
      <button onClick={() => setSelected(null)} className="text-xs text-ink-400">← Volver a listas</button>
      <div className="mt-3 rounded-card border border-gold/30 bg-gold/5 p-4">
        <h2 className="font-display text-xl font-semibold">{selected.standing.deck?.name ?? "Lista de torneo"}</h2>
        <p className="text-xs text-ink-400">{selected.standing.name} · puesto #{selected.standing.placing} · {selected.tournament.name}</p>
        <p className="mt-3 text-lg"><span className="text-gold">{totals.percentage}%</span> de la lista está en tu colección ({totals.owned}/{totals.required})</p>
        <div className="mt-3 flex gap-2"><button onClick={importSelected} className="rounded-full bg-gold px-4 py-2 text-sm font-medium text-ink-900">Importar esta lista</button><a href={limitlessTournamentUrl(selected.tournament.id)} target="_blank" rel="noreferrer" className="rounded-full border border-ink-600 px-4 py-2 text-sm">Ver torneo en Limitless</a></div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">{preview.map((item, index) => {
        const status = item.free >= item.line.quantity ? "Disponible" : item.owned >= item.line.quantity ? "En otro mazo/binder" : "Faltante";
        const color = status === "Disponible" ? "text-grass border-grass/30" : status === "En otro mazo/binder" ? "text-holo-cyan border-holo-cyan/30" : "text-danger border-danger/30";
        const imageUrl = item.card ? cardImageUrl(item.card.image, "low", "webp") : "";
        return <div key={`${item.line.name}-${index}`} className="min-w-0 rounded border border-ink-700 bg-ink-800 p-2"><div className="relative aspect-[0.72] w-full overflow-hidden rounded-sm bg-ink-900">{imageUrl ? <CardImage src={imageUrl} alt={item.line.name} className="object-contain" sizes="(min-width:1280px) 120px, (min-width:640px) 22vw, 45vw" /> : <div className="flex h-full items-center justify-center px-1 text-center text-xs text-ink-500">Energía básica</div>}</div><p className="mt-2 truncate text-sm font-medium">{item.line.name} <span className="font-mono text-gold">×{item.line.quantity}</span></p><p className="truncate text-[10px] text-ink-400">{item.line.setCode} {item.line.number}</p><span className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-[9px] ${color}`}>{status} · tienes {item.owned}</span></div>;
      })}</div>
      {unmatched.length > 0 && <div className="mt-4 rounded-lg border border-danger/30 p-3"><p className="text-sm text-danger">Sin resolver ({unmatched.length})</p>{unmatched.map((line) => <p key={line.label} className="text-xs text-ink-400">{line.label}</p>)}</div>}
    </section>}
  </div>;
}
