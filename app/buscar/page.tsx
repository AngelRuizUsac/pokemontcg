"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { PokemonCard, SetBrief } from "@/lib/types";
import {
  searchCardsAdvanced,
  getCardById,
  listSets,
  expandRegulationMarkRange,
} from "@/lib/tcgdex";
import CardTile from "@/components/CardTile";
import AddToCollectionModal from "@/components/AddToCollectionModal";
import { getSettings } from "@/lib/storage";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/currency";
import { CARD_TYPE_OPTIONS, matchesCardTypeFilter } from "@/lib/cardTypeFilter";
import { resolveMarketPriceUsd } from "@/lib/types";
import LoadingIndicator from "@/components/LoadingIndicator";

type SortOption = "relevance" | "price-desc" | "price-asc" | "name";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "relevance", label: "Relevancia" },
  { value: "price-desc", label: "Precio (mayor a menor)" },
  { value: "price-asc", label: "Precio (menor a mayor)" },
  { value: "name", label: "Nombre (A-Z)" },
];

function sortResults(cards: PokemonCard[], sort: SortOption): PokemonCard[] {
  const sorted = [...cards];
  switch (sort) {
    case "price-desc":
      return sorted.sort((a, b) => (resolveMarketPriceUsd(b) ?? -1) - (resolveMarketPriceUsd(a) ?? -1));
    case "price-asc":
      return sorted.sort((a, b) => {
        const pa = resolveMarketPriceUsd(a);
        const pb = resolveMarketPriceUsd(b);
        if (pa == null) return 1;
        if (pb == null) return -1;
        return pa - pb;
      });
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return sorted;
  }
}

export default function BuscarPage() {
  const [term, setTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sort, setSort] = useState<SortOption>("relevance");
  const [results, setResults] = useState<PokemonCard[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PokemonCard | null>(null);
  const [exchangeRate, setExchangeRate] = useState(DEFAULT_EXCHANGE_RATE);
  const [savedFlash, setSavedFlash] = useState(false);

  // filtro por expansión + número
  const [setFilterOn, setSetFilterOn] = useState(false);
  const [sets, setSets] = useState<SetBrief[]>([]);
  const [setId, setSetId] = useState("");
  const [number, setNumber] = useState("");

  // filtro por regulation mark (independiente, no requiere los otros)
  const [markFilterOn, setMarkFilterOn] = useState(false);
  const [markFrom, setMarkFrom] = useState("");
  const [markTo, setMarkTo] = useState("");

  useEffect(() => {
    setExchangeRate(getSettings().exchangeRate);
  }, []);

  useEffect(() => {
    if (setFilterOn && sets.length === 0) {
      listSets()
        .then(setSets)
        .catch(() => setError("No se pudo cargar la lista de expansiones."));
    }
  }, [setFilterOn, sets.length]);

  async function runSearch(e?: FormEvent, targetPage = 1) {
    e?.preventDefault();

    const hasName = term.trim().length > 0;
    const hasSet = setFilterOn && setId;
    const hasMark = markFilterOn && markFrom.trim().length > 0;

    if (!hasName && !hasSet && !hasMark) {
      setError("Escribe un nombre, o activa el filtro de expansión y/o regulation mark.");
      return;
    }

    targetPage === 1 ? setLoading(true) : setLoadingMore(true);
    setError(null);
    try {
      const regulationMarks = hasMark
        ? expandRegulationMarkRange(markFrom, markTo || undefined)
        : undefined;

      const { briefs, hasMore: more } = await searchCardsAdvanced({
        name: hasName ? term.trim() : undefined,
        setId: hasSet ? setId : undefined,
        number: hasSet && number.trim() ? number.trim() : undefined,
        regulationMarks,
        page: targetPage,
      });

      let detailed = await Promise.all(briefs.map((b) => getCardById(b.id)));

      if (hasMark && hasSet) {
        detailed = detailed.filter((c) => regulationMarks!.includes(c.regulationMark ?? ""));
      }
      if (typeFilter) {
        detailed = detailed.filter((c) =>
          matchesCardTypeFilter(typeFilter, c.category, c.trainerType, c.energyType)
        );
      }

      setResults((prev) => (targetPage === 1 ? detailed : [...prev, ...detailed]));
      setHasMore(more);
      setPage(targetPage);
    } catch (err) {
      setError("No se pudo buscar. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  return (
    <div>
      <h1 className="font-display font-bold text-2xl">Buscar cartas</h1>
      <p className="text-ink-400 text-sm mt-1">
        Busca por nombre en TCGdex, o usa los filtros de expansión, regulation mark y tipo —
        cada uno funciona solo o combinado, sin necesitar los demás.
      </p>

      <form onSubmit={(e) => runSearch(e, 1)} className="mt-6 flex flex-col gap-4">
        <div className="flex gap-2">
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Ej. Charizard, Pikachu, Ultra Ball… (opcional si usas los filtros)"
            className="flex-1 bg-ink-800 border border-ink-700 rounded-full px-4 py-2.5 text-sm outline-none focus:border-gold/60"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-full bg-gold text-ink-900 text-sm font-medium hover:bg-gold-light disabled:opacity-60"
          >
            {loading ? <LoadingIndicator label="Buscando…" compact /> : "Buscar"}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Filtro: expansión + número */}
          <div className="flex-1 bg-ink-800 border border-ink-700 rounded-card p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={setFilterOn}
                onChange={(e) => setSetFilterOn(e.target.checked)}
                className="accent-gold"
              />
              Filtrar por expansión y número
            </label>
            {setFilterOn && (
              <div className="mt-2 flex gap-2">
                <select
                  value={setId}
                  onChange={(e) => setSetId(e.target.value)}
                  className="flex-1 bg-ink-900 border border-ink-700 rounded px-2 py-1.5 text-xs"
                >
                  <option value="">
                    {sets.length === 0 ? "Cargando expansiones…" : "Elige una expansión…"}
                  </option>
                  {sets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="# (opcional)"
                  className="w-24 bg-ink-900 border border-ink-700 rounded px-2 py-1.5 text-xs font-mono"
                />
              </div>
            )}
          </div>

          {/* Filtro: regulation mark — independiente, no requiere otros filtros */}
          <div className="flex-1 bg-ink-800 border border-ink-700 rounded-card p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={markFilterOn}
                onChange={(e) => setMarkFilterOn(e.target.checked)}
                className="accent-gold"
              />
              Filtrar por regulation mark
            </label>
            {markFilterOn && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={markFrom}
                  onChange={(e) => setMarkFrom(e.target.value.slice(0, 1).toUpperCase())}
                  placeholder="D"
                  maxLength={1}
                  className="w-14 bg-ink-900 border border-ink-700 rounded px-2 py-1.5 text-xs font-mono text-center"
                />
                <span className="text-ink-400 text-xs">a (opcional, para un rango)</span>
                <input
                  value={markTo}
                  onChange={(e) => setMarkTo(e.target.value.slice(0, 1).toUpperCase())}
                  placeholder="J"
                  maxLength={1}
                  className="w-14 bg-ink-900 border border-ink-700 rounded px-2 py-1.5 text-xs font-mono text-center"
                />
              </div>
            )}
          </div>

          {/* Filtro: tipo de carta */}
          <div className="flex-1 bg-ink-800 border border-ink-700 rounded-card p-3">
            <label className="text-sm font-medium block mb-2">Tipo de carta</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-ink-900 border border-ink-700 rounded px-2 py-1.5 text-xs"
            >
              {CARD_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </form>

      {loading && <LoadingIndicator label="Buscando cartas…" />}
      {error && <p className="text-danger text-sm mt-8">{error}</p>}

      {!loading && !error && results.length === 0 && (term || setFilterOn || markFilterOn) && (
        <p className="text-ink-400 text-sm mt-8">Sin resultados para esta búsqueda.</p>
      )}

      {results.length > 0 && (
        <div className="mt-6 flex justify-end">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="bg-ink-800 border border-ink-700 rounded px-2 py-1.5 text-xs"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {sortResults(results, sort).map((card) => (
          <CardTile key={card.id} card={card} exchangeRate={exchangeRate} onAdd={setSelected} />
        ))}
      </div>

      {hasMore && !loading && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => runSearch(undefined, page + 1)}
            disabled={loadingMore}
            className="px-5 py-2.5 rounded-full bg-ink-700 text-ink-100 text-sm font-medium hover:bg-ink-600 disabled:opacity-50"
          >
            {loadingMore ? <LoadingIndicator label="Cargando…" compact /> : "Ver más resultados"}
          </button>
        </div>
      )}

      {selected && (
        <AddToCollectionModal
          card={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            setSavedFlash(true);
            setTimeout(() => setSavedFlash(false), 2500);
          }}
        />
      )}

      {savedFlash && (
        <div className="fixed bottom-6 right-6 bg-grass/15 border border-grass/40 text-grass text-sm px-4 py-2.5 rounded-full">
          Carta guardada en tu colección
        </div>
      )}
    </div>
  );
}
