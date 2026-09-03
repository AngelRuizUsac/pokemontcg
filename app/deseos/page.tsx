"use client";

import { useEffect, useState, useCallback } from "react";
import type { FormEvent } from "react";
import {
  getWishlist,
  removeWishlistItem,
  updateWishlistItem,
  getSettings,
  addOrMergeToCollection,
  addWishlistItem,
} from "@/lib/storage";
import type { WishlistItem, WishlistPriority } from "@/lib/storage";
import { searchCards, getCardById, cardImageUrl, resolveSetCode, buildTcgPlayerSearchUrl } from "@/lib/tcgdex";
import { resolveMarketPriceUsd } from "@/lib/types";
import type { PokemonCard } from "@/lib/types";
import { computeEffectSignature } from "@/lib/reprints";
import { DEFAULT_EXCHANGE_RATE, formatGtq, formatUsd, usdToGtq } from "@/lib/currency";
import CardImage from "@/components/CardImage";
import LoadingIndicator from "@/components/LoadingIndicator";

const PRIORITY_LABEL: Record<WishlistPriority, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const PRIORITY_ORDER: Record<WishlistPriority, number> = { high: 0, medium: 1, low: 2 };

export default function DeseosPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [exchangeRate, setExchangeRate] = useState(DEFAULT_EXCHANGE_RATE);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<PokemonCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setItems(getWishlist());
    setExchangeRate(getSettings().exchangeRate);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runSearch(e?: FormEvent) {
    e?.preventDefault();
    if (!term.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const briefs = await searchCards(term.trim());
      const detailed = await Promise.all(briefs.map((b) => getCardById(b.id)));
      setResults(detailed);
    } catch {
      setError("No se pudo buscar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  function addToWishlist(card: PokemonCard) {
    addWishlistItem({
      cardId: card.id,
      cardName: card.name,
      category: card.category,
      setId: card.set.id,
      setName: card.set.name,
      number: card.localId,
      imageUrl: cardImageUrl(card.image, "low", "webp"),
      priceUsd: resolveMarketPriceUsd(card),
      priority: "medium",
      notes: null,
    });
    load();
  }

  async function markObtained(item: WishlistItem) {
    if (!confirm(`¿Ya la conseguiste? Se agregará 1 copia de "${item.cardName}" a tu colección.`)) return;
    try {
      const card = await getCardById(item.cardId);
      addOrMergeToCollection({
        cardId: card.id,
        cardName: card.name,
        category: card.category,
        trainerType: card.trainerType ?? null,
        energyType: card.energyType ?? null,
        setId: card.set.id,
        setName: card.set.name,
        setAbbreviation: resolveSetCode(card.set),
        number: card.localId,
        rarity: card.rarity ?? null,
        regulationMark: card.regulationMark ?? null,
        imageUrl: cardImageUrl(card.image, "low", "webp"),
        tcgPlayerUrl: buildTcgPlayerSearchUrl(card.name, card.set.name),
        quantity: 1,
        condition: "NM",
        language: "EN",
        isHolo: false,
        priceUsd: resolveMarketPriceUsd(card),
        priceUpdatedAt: new Date().toISOString(),
        askingPriceUsd: null,
        notes: null,
        markedBulk: false,
        effectSignature: computeEffectSignature(card),
      });
      removeWishlistItem(item.id);
      load();
    } catch {
      alert("No se pudo agregar la carta. Intenta de nuevo.");
    }
  }

  const sorted = [...items].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const totalUsd = items.reduce((sum, i) => sum + (i.priceUsd ?? 0), 0);

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl">Lista de deseos</h1>
          <p className="text-ink-400 text-sm mt-1">
            Cartas que quieres conseguir — no pertenecen a ningún mazo ni cuentan en tu colección.
          </p>
        </div>
        {items.length > 0 && (
          <div className="bg-ink-800 border border-ink-700 rounded-card px-5 py-3">
            <p className="text-ink-400 text-[11px] uppercase tracking-wide">Costo estimado</p>
            <p className="font-mono text-xl text-gold mt-0.5">{formatGtq(usdToGtq(totalUsd, exchangeRate))}</p>
            <p className="font-mono text-xs text-ink-400">{formatUsd(totalUsd)}</p>
          </div>
        )}
      </div>

      <form onSubmit={runSearch} className="mt-6 flex gap-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar una carta para agregar a deseos…"
          className="flex-1 bg-ink-800 border border-ink-700 rounded-full px-4 py-2.5 text-sm outline-none focus:border-gold/60"
        />
        <button
          type="submit"
          className="px-5 py-2.5 rounded-full bg-gold text-ink-900 text-sm font-medium hover:bg-gold-light"
        >
          Buscar
        </button>
      </form>

      {loading && <LoadingIndicator label="Buscando cartas…" />}
      {error && <p className="text-danger text-sm mt-6">{error}</p>}

      {results.length > 0 && (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {results.map((card) => {
            const already = items.some((i) => i.cardId === card.id);
            return (
              <div key={card.id} className="bg-ink-800 border border-ink-700 rounded-card p-3">
                <div className="relative aspect-[5/7] rounded overflow-hidden bg-ink-900">
                  <CardImage
                    src={cardImageUrl(card.image, "low", "webp")}
                    alt={card.name}
                    sizes="200px"
                    className="object-contain"
                  />
                </div>
                <p className="text-sm font-medium mt-2 leading-tight truncate">{card.name}</p>
                <p className="text-ink-400 text-xs truncate">{card.set.name}</p>
                <button
                  onClick={() => addToWishlist(card)}
                  disabled={already}
                  className="mt-2 w-full text-xs font-medium bg-holo-pink/10 text-holo-pink border border-holo-pink/30 rounded-full py-1.5 hover:bg-holo-pink/20 disabled:opacity-50"
                >
                  {already ? "En tu lista" : "♡ Agregar a deseos"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8">
        {items.length === 0 ? (
          <p className="text-ink-400 text-sm">Todavía no tienes cartas en tu lista de deseos.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sorted.map((item) => (
              <div key={item.id} className="flex items-center gap-3 bg-ink-800 border border-ink-700 rounded-lg p-2.5">
                <div className="relative w-11 aspect-[5/7] rounded overflow-hidden bg-ink-900 shrink-0">
                  <CardImage src={item.imageUrl} alt={item.cardName} className="object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.cardName}</p>
                  <p className="text-ink-400 text-xs">
                    {item.setName} · #{item.number}
                  </p>
                  {item.priceUsd != null && (
                    <p className="text-gold text-xs font-mono">
                      {formatGtq(usdToGtq(item.priceUsd, exchangeRate))}
                    </p>
                  )}
                </div>
                <select
                  value={item.priority}
                  onChange={(e) => {
                    updateWishlistItem(item.id, { priority: e.target.value as WishlistPriority });
                    load();
                  }}
                  className="bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs"
                >
                  {(["high", "medium", "low"] as WishlistPriority[]).map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
                <a
                  href={buildTcgPlayerSearchUrl(item.cardName, item.setName)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-ink-400 hover:text-gold"
                >
                  Comprar
                </a>
                <button onClick={() => markObtained(item)} className="text-xs text-grass hover:underline">
                  Ya la tengo
                </button>
                <button
                  onClick={() => {
                    removeWishlistItem(item.id);
                    load();
                  }}
                  className="text-xs text-danger/80 hover:text-danger"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
