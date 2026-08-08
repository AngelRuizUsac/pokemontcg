"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import CollectionCard from "@/components/CollectionCard";
import { getCollection, getSettings, isEntryBulk } from "@/lib/storage";
import type { CollectionEntry, AppSettings } from "@/lib/storage";
import { DEFAULT_EXCHANGE_RATE, formatGtq, formatUsd, usdToGtq } from "@/lib/currency";
import { CARD_TYPE_OPTIONS, matchesCardTypeFilter } from "@/lib/cardTypeFilter";

const DEFAULT_SETTINGS: AppSettings = {
  exchangeRate: DEFAULT_EXCHANGE_RATE,
  bulkModeEnabled: false,
  bulkThresholdGtq: 5,
  standardMarkFrom: "",
  standardMarkTo: "",
};

type SortOption = "name" | "price-desc" | "price-asc" | "quantity-desc";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "name", label: "Nombre (A-Z)" },
  { value: "price-desc", label: "Precio (mayor a menor)" },
  { value: "price-asc", label: "Precio (menor a mayor)" },
  { value: "quantity-desc", label: "Cantidad (mayor a menor)" },
];

function sortEntries(entries: CollectionEntry[], sort: SortOption): CollectionEntry[] {
  const sorted = [...entries];
  switch (sort) {
    case "price-desc":
      return sorted.sort((a, b) => (b.priceUsd ?? 0) * b.quantity - (a.priceUsd ?? 0) * a.quantity);
    case "price-asc":
      return sorted.sort((a, b) => (a.priceUsd ?? 0) * a.quantity - (b.priceUsd ?? 0) * b.quantity);
    case "quantity-desc":
      return sorted.sort((a, b) => b.quantity - a.quantity);
    default:
      return sorted.sort((a, b) => a.cardName.localeCompare(b.cardName));
  }
}

export default function Home() {
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showBulk, setShowBulk] = useState(true);
  const [sort, setSort] = useState<SortOption>("name");

  const load = useCallback(() => {
    setEntries(getCollection());
    setSettings(getSettings());
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const term = search.trim().toLowerCase();
  const visible = sortEntries(
    entries.filter((e) => {
      if (term && !e.cardName.toLowerCase().includes(term)) return false;
      if (!matchesCardTypeFilter(typeFilter, e.category, e.trainerType, e.energyType)) return false;
      if (!showBulk && isEntryBulk(e, settings)) return false;
      return true;
    }),
    sort
  );

  const totalCards = entries.reduce((sum, e) => sum + e.quantity, 0);
  // Las cartas marcadas/clasificadas como bulk no suman al valor total.
  const totalUsd = entries
    .filter((e) => !isEntryBulk(e, settings))
    .reduce((sum, e) => sum + (e.priceUsd ?? 0) * e.quantity, 0);
  const bulkCount = entries.filter((e) => isEntryBulk(e, settings)).length;

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl">Mi colección</h1>
          <p className="text-ink-400 text-sm mt-1">
            {!loaded
              ? "Cargando…"
              : `${entries.length} cartas distintas · ${totalCards} unidades`}
          </p>
        </div>

        <div className="bg-ink-800 border border-ink-700 rounded-card px-5 py-3">
          <p className="text-ink-400 text-[11px] uppercase tracking-wide">
            Valor estimado de la colección
          </p>
          <p className="font-mono text-xl text-gold mt-0.5">
            {formatGtq(usdToGtq(totalUsd, settings.exchangeRate))}
          </p>
          <p className="font-mono text-xs text-ink-400">{formatUsd(totalUsd)}</p>
          {bulkCount > 0 && (
            <p className="text-ink-400 text-[10px] mt-1">sin contar {bulkCount} bulk</p>
          )}
        </div>
      </div>

      {!loaded && entries.length === 0 ? null : entries.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-ink-400">Todavía no tienes cartas registradas.</p>
          <Link
            href="/buscar/"
            className="inline-block mt-4 px-5 py-2.5 rounded-full bg-gold text-ink-900 text-sm font-medium hover:bg-gold-light"
          >
            Buscar mi primera carta
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en mi colección…"
              className="flex-1 min-w-[200px] bg-ink-800 border border-ink-700 rounded-full px-4 py-2 text-sm outline-none focus:border-gold/60"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-ink-800 border border-ink-700 rounded px-2 py-2 text-xs"
            >
              {CARD_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="bg-ink-800 border border-ink-700 rounded px-2 py-2 text-xs"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {bulkCount > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-ink-400">
                <input
                  type="checkbox"
                  checked={showBulk}
                  onChange={(e) => setShowBulk(e.target.checked)}
                  className="accent-gold"
                />
                Mostrar bulk ({bulkCount})
              </label>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="text-ink-400 text-sm mt-8">Ninguna carta coincide con este filtro.</p>
          ) : (
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {visible.map((entry) => (
                <CollectionCard key={entry.id} entry={entry} settings={settings} onChanged={load} />
              ))}
            </div>
          )}
        </>
      )}

      <p className="text-ink-400 text-xs mt-10 text-center">
        Tu colección se guarda en este navegador. Si cambias de dispositivo o
        borras los datos del sitio, no la verás ahí — usa el respaldo completo en
        Ajustes para moverla.
      </p>
    </div>
  );
}
