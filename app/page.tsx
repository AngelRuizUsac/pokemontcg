"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import CollectionCard from "@/components/CollectionCard";
import { getCollection, getSettings, isEntryBulk, updateCollectionEntry, mergeDuplicateCollectionEntries, entryValueUsd, getAvailableQuantity } from "@/lib/storage";
import type { CollectionEntry, AppSettings } from "@/lib/storage";
import { DEFAULT_EXCHANGE_RATE, formatGtq, formatUsd, usdToGtq } from "@/lib/currency";
import { CARD_TYPE_OPTIONS, matchesCardTypeFilter } from "@/lib/cardTypeFilter";
import { getCardById } from "@/lib/tcgdex";
import { resolveMarketPriceUsd } from "@/lib/types";
import LoadingIndicator from "@/components/LoadingIndicator";
import { deckGroupKey } from "@/lib/reprints";

const DEFAULT_SETTINGS: AppSettings = {
  exchangeRate: DEFAULT_EXCHANGE_RATE,
  bulkModeEnabled: false,
  bulkThresholdGtq: 5,
  standardMarkFrom: "",
  standardMarkTo: "",
  conditionMultipliers: { NM: 1, LP: 0.85, MP: 0.7, HP: 0.5, DMG: 0.3 },
};

type SortOption = "name" | "price-desc" | "price-asc" | "quantity-desc";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "name", label: "Nombre (A-Z)" },
  { value: "price-desc", label: "Precio (mayor a menor)" },
  { value: "price-asc", label: "Precio (menor a mayor)" },
  { value: "quantity-desc", label: "Cantidad (mayor a menor)" },
];

function sortEntries(entries: CollectionEntry[], sort: SortOption, settings: AppSettings): CollectionEntry[] {
  const sorted = [...entries];
  switch (sort) {
    case "price-desc":
      return sorted.sort((a, b) => entryValueUsd(b, settings) - entryValueUsd(a, settings));
    case "price-asc":
      return sorted.sort((a, b) => entryValueUsd(a, settings) - entryValueUsd(b, settings));
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
  const [rarityFilter, setRarityFilter] = useState("");
  const [showBulk, setShowBulk] = useState(true);
  const [showFree, setShowFree] = useState(true);
  const [showAssigned, setShowAssigned] = useState(true);
  const [groupReprints, setGroupReprints] = useState(false);
  const [sort, setSort] = useState<SortOption>("name");
  const [busyAction, setBusyAction] = useState<"prices" | "merge" | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setEntries(getCollection());
    setSettings(getSettings());
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function updatePrices() {
    setBusyAction("prices");
    setActionMsg(null);
    try {
      const current = getCollection();
      // agrupa por carta para no pedir el mismo precio varias veces si hay
      // holo/normal, distintas condiciones, etc. de la misma impresión
      const uniqueCardIds = Array.from(new Set(current.map((e) => e.cardId)));
      const priceByCardId = new Map<string, number | null>();

      await Promise.all(
        uniqueCardIds.map(async (cardId) => {
          try {
            const card = await getCardById(cardId);
            priceByCardId.set(cardId, resolveMarketPriceUsd(card));
          } catch {
            // si una carta falla, se deja su precio como estaba
          }
        })
      );

      let updated = 0;
      const now = new Date().toISOString();
      for (const entry of current) {
        if (!priceByCardId.has(entry.cardId)) continue;
        const priceUsd = priceByCardId.get(entry.cardId) ?? null;
        updateCollectionEntry(entry.id, { priceUsd, priceUpdatedAt: now });
        updated++;
      }
      setActionMsg(`Precios actualizados: ${updated} carta(s).`);
      load();
    } finally {
      setBusyAction(null);
    }
  }

  function mergeDuplicates() {
    setBusyAction("merge");
    setActionMsg(null);
    const { merged } = mergeDuplicateCollectionEntries();
    setActionMsg(
      merged > 0
        ? `Se unieron ${merged} entrada(s) repetida(s).`
        : "No había entradas repetidas para unir."
    );
    load();
    setBusyAction(null);
  }

  const term = search.trim().toLowerCase();
  const visible = sortEntries(
    entries.filter((e) => {
      if (term && !e.cardName.toLowerCase().includes(term)) return false;
      if (!matchesCardTypeFilter(typeFilter, e.category, e.trainerType, e.energyType)) return false;
      if (rarityFilter && e.rarity !== rarityFilter) return false;
      if (!showBulk && isEntryBulk(e, settings)) return false;
      const isFree = getAvailableQuantity(e.id) > 0;
      if (isFree && !showFree) return false;
      if (!isFree && !showAssigned) return false;
      return true;
    }),
    sort,
    settings
  );

  const totalCards = entries.reduce((sum, e) => sum + e.quantity, 0);
  const collectionGroups = Array.from(
    visible.reduce((groups, entry) => {
      const key = deckGroupKey(entry);
      const current = groups.get(key);
      if (current) {
        current.entries.push(entry);
        current.totalQuantity += entry.quantity;
      } else {
        groups.set(key, {
          key,
          cardName: entry.cardName,
          entries: [entry],
          totalQuantity: entry.quantity,
        });
      }
      return groups;
    }, new Map<string, { key: string; cardName: string; entries: CollectionEntry[]; totalQuantity: number }>()).values()
  );
  // Las cartas marcadas/clasificadas como bulk no suman al valor total, y el
  // valor de cada una se ajusta según su condición.
  const totalUsd = entries
    .filter((e) => !isEntryBulk(e, settings))
    .reduce((sum, e) => sum + entryValueUsd(e, settings), 0);
  const bulkCount = entries.filter((e) => isEntryBulk(e, settings)).length;
  const rarities = Array.from(
    new Set(entries.map((entry) => entry.rarity).filter((rarity): rarity is string => !!rarity))
  ).sort((a, b) => a.localeCompare(b));

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
          <div className="flex gap-2 mt-2">
            <button
              onClick={updatePrices}
              disabled={busyAction !== null || entries.length === 0}
              className="text-[11px] px-2.5 py-1 rounded-full bg-ink-700 text-ink-100 hover:bg-ink-600 disabled:opacity-50"
            >
              {busyAction === "prices" ? "Actualizando…" : "↻ Actualizar precios"}
            </button>
            <button
              onClick={mergeDuplicates}
              disabled={busyAction !== null || entries.length === 0}
              className="text-[11px] px-2.5 py-1 rounded-full bg-ink-700 text-ink-100 hover:bg-ink-600 disabled:opacity-50"
            >
              {busyAction === "merge" ? "Uniendo…" : "Unir repetidas"}
            </button>
          </div>
        </div>
      </div>

      {actionMsg && <p className="text-holo-cyan text-xs mt-3">{actionMsg}</p>}

      {!loaded && entries.length === 0 ? <LoadingIndicator label="Cargando colección…" /> : entries.length === 0 ? (
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
            <label className="flex items-center gap-1.5 text-xs text-ink-400">
              Rareza:
              <select
                value={rarityFilter}
                onChange={(e) => setRarityFilter(e.target.value)}
                className="bg-ink-800 border border-ink-700 rounded px-2 py-2 text-xs text-ink-50"
              >
                <option value="">Todas</option>
                {rarities.map((rarity) => (
                  <option key={rarity} value={rarity}>
                    {rarity}
                  </option>
                ))}
              </select>
            </label>
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
            <label className="flex items-center gap-1.5 text-xs text-ink-400">
              <input
                type="checkbox"
                checked={showFree}
                onChange={(e) => setShowFree(e.target.checked)}
                className="accent-gold"
              />
              Libres
            </label>
            <label className="flex items-center gap-1.5 text-xs text-ink-400">
              <input
                type="checkbox"
                checked={showAssigned}
                onChange={(e) => setShowAssigned(e.target.checked)}
                className="accent-gold"
              />
              Asignadas
            </label>
            <label className="flex items-center gap-1.5 text-xs text-ink-400">
              <input
                type="checkbox"
                checked={groupReprints}
                onChange={(e) => setGroupReprints(e.target.checked)}
                className="accent-gold"
              />
              Agrupar reimpresiones
            </label>
          </div>

          {visible.length === 0 ? (
            <p className="text-ink-400 text-sm mt-8">Ninguna carta coincide con este filtro.</p>
          ) : (
            groupReprints ? (
              <div className="mt-6 flex flex-col gap-3">
                {collectionGroups.map((group) => (
                  <details key={group.key} className="rounded-card border border-ink-700 bg-ink-800" open={group.entries.length === 1}>
                    <summary className="flex cursor-pointer items-center justify-between gap-3 p-3">
                      <span className="font-display font-semibold text-sm">{group.cardName}</span>
                      <span className="text-xs text-ink-400">
                        x{group.totalQuantity} · {group.entries.length} {group.entries.length === 1 ? "impresión" : "impresiones"}
                      </span>
                    </summary>
                    <div className="grid grid-cols-2 gap-4 border-t border-ink-700 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {group.entries.map((entry) => (
                        <CollectionCard key={entry.id} entry={entry} settings={settings} onChanged={load} />
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {visible.map((entry) => (
                  <CollectionCard key={entry.id} entry={entry} settings={settings} onChanged={load} />
                ))}
              </div>
            )
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
