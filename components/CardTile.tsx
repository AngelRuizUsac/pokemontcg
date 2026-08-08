"use client";

import { useState } from "react";
import type { PokemonCard } from "@/lib/types";
import { resolveMarketPriceUsd } from "@/lib/types";
import { cardImageUrl, buildTcgPlayerSearchUrl } from "@/lib/tcgdex";
import { rarityBorderClass, isFoilRarity } from "@/lib/rarity";
import PriceTicket from "./PriceTicket";
import CardImage from "./CardImage";
import CardDetailModal from "./CardDetailModal";

export default function CardTile({
  card,
  exchangeRate,
  onAdd,
}: {
  card: PokemonCard;
  exchangeRate: number;
  onAdd: (card: PokemonCard) => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const priceUsd = resolveMarketPriceUsd(card);
  const tcgPlayerUrl = buildTcgPlayerSearchUrl(card.name, card.set.name);
  const foil = isFoilRarity(card.rarity);

  return (
    <div
      className={`group relative rounded-card border bg-ink-800 p-3 flex flex-col gap-2 transition-transform hover:-translate-y-0.5 ${rarityBorderClass(
        card.rarity
      )}`}
    >
      {foil && (
        <div className="absolute inset-0 rounded-card bg-holo-gradient opacity-0 group-hover:opacity-10 pointer-events-none transition-opacity" />
      )}

      <button
        onClick={() => setShowDetail(true)}
        className="relative aspect-[5/7] rounded overflow-hidden bg-ink-900"
        title="Ver detalle de la carta"
      >
        <CardImage
          src={cardImageUrl(card.image, "low", "webp")}
          alt={card.name}
          sizes="200px"
          className="object-contain"
        />
      </button>

      <button onClick={() => setShowDetail(true)} className="flex-1 text-left">
        <p className="font-display font-semibold text-sm leading-tight">{card.name}</p>
        <p className="text-ink-400 text-xs mt-0.5">
          {card.set.name} · #{card.localId}
        </p>
        {card.rarity && (
          <p className="text-ink-400 text-[11px] mt-0.5">{card.rarity}</p>
        )}
      </button>

      <PriceTicket priceUsd={priceUsd} exchangeRate={exchangeRate} tcgPlayerUrl={tcgPlayerUrl} size="sm" />

      <button
        onClick={() => onAdd(card)}
        className="mt-1 text-xs font-medium bg-gold/10 text-gold border border-gold/30 rounded-full py-1.5 hover:bg-gold/20 transition-colors"
      >
        + Agregar a mi colección
      </button>

      {showDetail && (
        <CardDetailModal
          cardId={card.id}
          exchangeRate={exchangeRate}
          onClose={() => setShowDetail(false)}
        />
      )}
    </div>
  );
}
