"use client";

import { useEffect, useState } from "react";
import { getCardById, cardImageUrl, buildTcgPlayerSearchUrl } from "@/lib/tcgdex";
import { resolveMarketPriceUsd } from "@/lib/types";
import type { PokemonCard } from "@/lib/types";
import { addWishlistItem, isInWishlist } from "@/lib/storage";
import PriceTicket from "./PriceTicket";
import CardImage from "./CardImage";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/currency";

export default function CardDetailModal({
  cardId,
  exchangeRate = DEFAULT_EXCHANGE_RATE,
  onClose,
}: {
  cardId: string;
  exchangeRate?: number;
  onClose: () => void;
}) {
  const [card, setCard] = useState<PokemonCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wishlisted, setWishlisted] = useState(false);

  useEffect(() => {
    setWishlisted(isInWishlist(cardId));
  }, [cardId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCardById(cardId)
      .then((c) => !cancelled && setCard(c))
      .catch(() => !cancelled && setError("No se pudo cargar el detalle de la carta."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-ink-800 border border-ink-700 rounded-card max-w-2xl w-full max-h-[90vh] overflow-y-auto scrollbar-thin p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button onClick={onClose} className="text-ink-400 text-sm hover:text-ink-50">
            ✕ Cerrar
          </button>
        </div>

        {loading && <p className="text-ink-400 text-sm text-center py-12">Cargando carta…</p>}
        {error && <p className="text-danger text-sm text-center py-12">{error}</p>}

        {card && (
          <div className="grid sm:grid-cols-[220px_1fr] gap-6 mt-2">
            <div className="relative aspect-[5/7] rounded-card overflow-hidden bg-ink-900 mx-auto sm:mx-0 w-full max-w-[220px]">
              <CardImage
                src={cardImageUrl(card.image, "high", "png")}
                alt={card.name}
                sizes="220px"
                className="object-contain"
              />
            </div>

            <div>
              <h2 className="font-display font-bold text-2xl">{card.name}</h2>
              <p className="text-ink-400 text-sm mt-0.5">
                {card.set.name} · #{card.localId}
                {card.rarity && ` · ${card.rarity}`}
              </p>

              <div className="flex flex-wrap gap-1.5 mt-3">
                <Tag>{card.category === "Pokemon" ? "Pokémon" : card.category}</Tag>
                {card.trainerType && <Tag>{card.trainerType}</Tag>}
                {card.energyType && <Tag>{card.energyType} Energy</Tag>}
                {card.stage && <Tag>{card.stage}</Tag>}
                {card.types?.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
                {card.regulationMark && <Tag>Marca {card.regulationMark}</Tag>}
              </div>

              {(card.hp != null || card.evolveFrom || card.retreat != null) && (
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-ink-100">
                  {card.hp != null && <span>HP {card.hp}</span>}
                  {card.evolveFrom && <span>Evoluciona de {card.evolveFrom}</span>}
                  {card.retreat != null && <span>Retirada: {card.retreat}</span>}
                </div>
              )}

              {card.abilities && card.abilities.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  {card.abilities.map((a, i) => (
                    <div key={i} className="bg-ink-900 rounded p-2.5">
                      <p className="text-holo-cyan text-xs font-semibold">
                        {a.type ? `${a.type} — ` : ""}
                        {a.name}
                      </p>
                      {a.effect && <p className="text-ink-100 text-xs mt-1">{a.effect}</p>}
                    </div>
                  ))}
                </div>
              )}

              {card.attacks && card.attacks.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {card.attacks.map((a, i) => (
                    <div key={i} className="bg-ink-900 rounded p-2.5">
                      <div className="flex justify-between items-baseline">
                        <p className="text-sm font-medium">
                          {a.cost && a.cost.length > 0 ? `[${a.cost.join(" ")}] ` : ""}
                          {a.name}
                        </p>
                        {a.damage != null && (
                          <p className="font-mono text-sm text-gold">{a.damage}</p>
                        )}
                      </div>
                      {a.effect && <p className="text-ink-400 text-xs mt-1">{a.effect}</p>}
                    </div>
                  ))}
                </div>
              )}

              {card.effect && (
                <div className="mt-3 bg-ink-900 rounded p-2.5">
                  <p className="text-ink-100 text-xs">{card.effect}</p>
                </div>
              )}

              {card.description && (
                <p className="text-ink-400 text-xs italic mt-3">{card.description}</p>
              )}

              {(card.weaknesses?.length || card.resistances?.length) && (
                <div className="flex gap-4 mt-3 text-xs">
                  {card.weaknesses?.map((w, i) => (
                    <span key={`w-${i}`} className="text-danger">
                      Debilidad: {w.type} {w.value}
                    </span>
                  ))}
                  {card.resistances?.map((r, i) => (
                    <span key={`r-${i}`} className="text-grass">
                      Resistencia: {r.type} {r.value}
                    </span>
                  ))}
                </div>
              )}

              {card.legal && (
                <div className="flex gap-2 mt-3">
                  <LegalPill label="Standard" legal={card.legal.standard} />
                  <LegalPill label="Expanded" legal={card.legal.expanded} />
                </div>
              )}

              {card.illustrator && (
                <p className="text-ink-400 text-[11px] mt-3">Ilustración: {card.illustrator}</p>
              )}

              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <PriceTicket
                  priceUsd={resolveMarketPriceUsd(card)}
                  exchangeRate={exchangeRate}
                  tcgPlayerUrl={buildTcgPlayerSearchUrl(card.name, card.set.name)}
                />
                <button
                  onClick={() => {
                    if (!card) return;
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
                    setWishlisted(true);
                  }}
                  disabled={wishlisted}
                  className={`text-xs px-3 py-1.5 rounded-full border ${
                    wishlisted
                      ? "bg-holo-pink/10 border-holo-pink/30 text-holo-pink"
                      : "bg-ink-900 border-ink-700 text-ink-100 hover:border-holo-pink/40"
                  }`}
                >
                  {wishlisted ? "♥ En tu lista de deseos" : "♡ Agregar a deseos"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] bg-ink-900 border border-ink-700 rounded-full px-2 py-0.5 text-ink-100">
      {children}
    </span>
  );
}

function LegalPill({ label, legal }: { label: string; legal?: boolean }) {
  return (
    <span
      className={`text-[11px] rounded-full px-2 py-0.5 border ${
        legal
          ? "bg-grass/10 border-grass/30 text-grass"
          : "bg-ink-900 border-ink-700 text-ink-400"
      }`}
    >
      {label} {legal ? "✓" : "✕"}
    </span>
  );
}
