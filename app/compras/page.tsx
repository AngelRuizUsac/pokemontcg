"use client";

import { useEffect, useState, useCallback } from "react";
import { buildShoppingList } from "@/lib/shoppingList";
import type { ShoppingLine } from "@/lib/shoppingList";
import { getSettings, addOrMergeToCollection, refreshWorkSlots, removeWishlistItem, fulfillUsedElsewhereLink } from "@/lib/storage";
import { getCardById, cardImageUrl, resolveSetCode, buildTcgPlayerSearchUrl } from "@/lib/tcgdex";
import { resolveMarketPriceUsd } from "@/lib/types";
import { computeEffectSignature } from "@/lib/reprints";
import { DEFAULT_EXCHANGE_RATE, formatGtq, formatUsd, usdToGtq } from "@/lib/currency";
import CardImage from "@/components/CardImage";

export default function ComprasPage() {
  const [lines, setLines] = useState<ShoppingLine[]>([]);
  const [exchangeRate, setExchangeRate] = useState(DEFAULT_EXCHANGE_RATE);
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = useCallback(() => {
    setLines(buildShoppingList());
    setExchangeRate(getSettings().exchangeRate);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markPurchased(line: ShoppingLine) {
    setBusyId(line.key);
    try {
      const card = await getCardById(line.cardId);
      addOrMergeToCollection({
        cardId: card.id, cardName: card.name, category: card.category,
        trainerType: card.trainerType ?? null, energyType: card.energyType ?? null,
        setId: card.set.id, setName: card.set.name, setAbbreviation: resolveSetCode(card.set),
        number: card.localId, rarity: card.rarity ?? null, regulationMark: card.regulationMark ?? null,
        imageUrl: cardImageUrl(card.image, "low", "webp"),
        tcgPlayerUrl: buildTcgPlayerSearchUrl(card.name, card.set.name),
        quantity: line.totalQuantity, condition: "NM", language: "EN", isHolo: false,
        priceUsd: resolveMarketPriceUsd(card), priceUpdatedAt: new Date().toISOString(),
        askingPriceUsd: null, notes: null, markedBulk: false,
        effectSignature: computeEffectSignature(card),
      });
      for (const source of line.sources) {
        if (source.type === "deck") refreshWorkSlots(source.id);
        else removeWishlistItem(source.id);
      }
      load();
    } catch {
      alert("No se pudo agregar la carta. Intenta de nuevo.");
    } finally { setBusyId(null); }
  }

  function moveHere(line: ShoppingLine) {
    for (const move of line.moves) {
      const result = fulfillUsedElsewhereLink(move.linkId);
      if (!result.ok && result.reason) alert(result.reason);
    }
    load();
  }

  const ownedElsewhere = lines.filter((line) => line.availability === "owned-elsewhere");
  const trulyMissing = lines.filter((line) => line.availability === "missing");
  const totalUsd = trulyMissing.reduce((sum, line) => sum + (line.priceUsd ?? 0) * line.totalQuantity, 0);

  function renderLine(line: ShoppingLine) {
    const alreadyOwned = line.availability === "owned-elsewhere";
    return (
      <div key={line.key} className={`flex flex-wrap sm:flex-nowrap items-center gap-3 border rounded-lg p-2.5 ${alreadyOwned ? "bg-holo-cyan/5 border-holo-cyan/30" : "bg-ink-800 border-ink-700"}`}>
        <div className="relative w-11 aspect-[5/7] rounded overflow-hidden bg-ink-900 shrink-0">
          <CardImage src={line.imageUrl} alt={line.cardName} className="object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{line.cardName} <span className="text-ink-400 font-mono">x{line.totalQuantity}</span></p>
          <p className="text-ink-400 text-xs">{line.setName} · #{line.number}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {alreadyOwned ? line.moves.map((move) => (
              <span key={move.linkId} className="text-[10px] px-1.5 py-0.5 rounded-full border text-holo-cyan border-holo-cyan/30 bg-holo-cyan/10">
                {move.fromLabel} → {move.toLabel} x{move.quantity}
              </span>
            )) : line.sources.map((source, index) => (
              <span key={index} className={`text-[10px] px-1.5 py-0.5 rounded-full border ${source.type === "wishlist" ? "text-holo-pink border-holo-pink/30 bg-holo-pink/10" : "text-holo-cyan border-holo-cyan/30 bg-holo-cyan/10"}`}>
                {source.label} x{source.quantity}
              </span>
            ))}
          </div>
        </div>
        {alreadyOwned ? (
          <button onClick={() => moveHere(line)} className="text-xs px-3 py-1.5 rounded-full bg-holo-cyan/10 text-holo-cyan border border-holo-cyan/30 hover:bg-holo-cyan/20 shrink-0">Mover aquí</button>
        ) : (
          <>
            {line.priceUsd != null && <p className="font-mono text-sm text-gold shrink-0">{formatGtq(usdToGtq(line.priceUsd * line.totalQuantity, exchangeRate))}</p>}
            <a href={buildTcgPlayerSearchUrl(line.cardName, line.setName)} target="_blank" rel="noopener noreferrer" className="text-xs text-ink-400 hover:text-gold shrink-0">Comprar</a>
            <button onClick={() => markPurchased(line)} disabled={busyId === line.key} className="text-xs px-3 py-1.5 rounded-full bg-grass/10 text-grass border border-grass/30 hover:bg-grass/20 disabled:opacity-50 shrink-0">{busyId === line.key ? "Agregando…" : "Ya la compré"}</button>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl">Lista de compra</h1>
          <p className="text-ink-400 text-sm mt-1">Separa las cartas que puedes mover de otro mazo de las que realmente debes comprar.</p>
        </div>
        {trulyMissing.length > 0 && (
          <div className="bg-ink-800 border border-ink-700 rounded-card px-5 py-3">
            <p className="text-ink-400 text-[11px] uppercase tracking-wide">Costo real pendiente</p>
            <p className="font-mono text-xl text-gold mt-0.5">{formatGtq(usdToGtq(totalUsd, exchangeRate))}</p>
            <p className="font-mono text-xs text-ink-400">{formatUsd(totalUsd)}</p>
          </div>
        )}
      </div>
      {lines.length === 0 ? (
        <p className="text-ink-400 text-sm mt-8">No tienes cartas pendientes por mover o comprar.</p>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {ownedElsewhere.length > 0 && (
            <section>
              <h2 className="font-display font-semibold text-lg">Ya las tienes en otro mazo</h2>
              <p className="text-ink-400 text-xs mt-1">Puedes moverlas; no se incluyen en el costo de compra.</p>
              <div className="mt-3 flex flex-col gap-2">{ownedElsewhere.map(renderLine)}</div>
            </section>
          )}
          {trulyMissing.length > 0 && (
            <section>
              <h2 className="font-display font-semibold text-lg">Cartas que realmente faltan</h2>
              <p className="text-ink-400 text-xs mt-1">No están disponibles en tu colección y sí necesitas comprarlas.</p>
              <div className="mt-3 flex flex-col gap-2">{trulyMissing.map(renderLine)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
