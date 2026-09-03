"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { decodeSharePayload } from "@/lib/share";
import type { SharePayload } from "@/lib/share";
import { getCardById, cardImageUrl } from "@/lib/tcgdex";
import { resolveMarketPriceUsd } from "@/lib/types";
import type { PokemonCard } from "@/lib/types";
import ContainerIcon from "@/components/ContainerIcon";
import { formatGtq, formatUsd, usdToGtq, DEFAULT_EXCHANGE_RATE } from "@/lib/currency";
import LoadingIndicator from "@/components/LoadingIndicator";

interface ResolvedItem {
  card: PokemonCard;
  quantity: number;
  askingPriceUsd?: number | null;
}

export default function VerCompartidoPage() {
  const [payload, setPayload] = useState<SharePayload | null | undefined>(undefined);
  const [items, setItems] = useState<ResolvedItem[]>([]);
  const [missing, setMissing] = useState<ResolvedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const encoded = params.get("d");
    const decoded = encoded ? decodeSharePayload(encoded) : null;
    setPayload(decoded);

    if (!decoded) {
      setLoading(false);
      return;
    }

    (async () => {
      const resolvedItems = await Promise.all(
        decoded.items.map(async (it) => ({
          card: await getCardById(it.cardId),
          quantity: it.quantity,
          askingPriceUsd: it.askingPriceUsd ?? null,
        }))
      );
      const resolvedMissing = await Promise.all(
        decoded.missing.map(async (it) => ({
          card: await getCardById(it.cardId),
          quantity: it.quantity,
        }))
      );
      setItems(resolvedItems);
      setMissing(resolvedMissing);
      setLoading(false);
    })();
  }, []);

  if (payload === undefined || loading) {
    return <LoadingIndicator label="Cargando colección compartida…" />;
  }

  if (!payload) {
    return (
      <p className="text-danger text-sm">
        Este enlace no es válido o está incompleto. Pide a quien te lo compartió que lo genere de nuevo.
      </p>
    );
  }

  const totalUsd = items.reduce((s, i) => s + (resolveMarketPriceUsd(i.card) ?? 0) * i.quantity, 0);
  const askingUsd = items.reduce((s, i) => s + (i.askingPriceUsd ?? 0) * i.quantity, 0);
  const exchangeRate = DEFAULT_EXCHANGE_RATE;

  return (
    <div>
      <div className="flex items-center gap-3">
        <ContainerIcon image={payload.image} size={48} />
        <div>
          <h1 className="font-display font-bold text-2xl">{payload.name}</h1>
          <p className="text-ink-400 text-sm">
            {payload.type === "deck" ? "Mazo" : "Binder"} compartido · solo lectura
          </p>
        </div>
      </div>

      <div className="mt-4 bg-ink-800 border border-ink-700 rounded-card px-5 py-3 w-fit">
        <p className="text-ink-400 text-[11px] uppercase tracking-wide">Valor estimado</p>
        <p className="font-mono text-xl text-gold mt-0.5">
          {formatGtq(usdToGtq(totalUsd, exchangeRate))}
        </p>
        <p className="font-mono text-xs text-ink-400">{formatUsd(totalUsd)}</p>
        {askingUsd > 0 && (
          <p className="font-mono text-xs text-holo-pink mt-1">
            en venta: {formatGtq(usdToGtq(askingUsd, exchangeRate))}
          </p>
        )}
      </div>

      <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {items.map(({ card, quantity, askingPriceUsd }) => (
          <div key={card.id} className="bg-ink-800 border border-ink-700 rounded-card p-3">
            <div className="relative aspect-[5/7] rounded overflow-hidden bg-ink-900">
              <Image
                src={cardImageUrl(card.image, "low", "webp")}
                alt={card.name}
                fill
                sizes="200px"
                className="object-contain"
              />
              <span className="absolute top-1.5 right-1.5 bg-ink-900/90 text-ink-50 text-[11px] font-mono px-1.5 py-0.5 rounded">
                x{quantity}
              </span>
            </div>
            <p className="text-sm font-medium mt-2 leading-tight">{card.name}</p>
            <p className="text-ink-400 text-xs">
              {card.set.name} · #{card.localId}
            </p>
            {askingPriceUsd != null && (
              <p className="text-holo-pink text-xs font-mono mt-0.5">
                en venta: {formatGtq(usdToGtq(askingPriceUsd * quantity, exchangeRate))}
              </p>
            )}
          </div>
        ))}
      </div>

      {missing.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display font-semibold text-lg">Cartas que le faltan</h2>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {missing.map(({ card, quantity }) => (
              <div
                key={card.id}
                className="bg-ink-800 border border-dashed border-danger/40 rounded-card p-3"
              >
                <div className="relative aspect-[5/7] rounded overflow-hidden bg-ink-900">
                  <Image
                    src={cardImageUrl(card.image, "low", "webp")}
                    alt={card.name}
                    fill
                    sizes="200px"
                    className="object-contain"
                  />
                  <span className="absolute top-1.5 right-1.5 bg-ink-900/90 text-ink-50 text-[11px] font-mono px-1.5 py-0.5 rounded">
                    x{quantity}
                  </span>
                </div>
                <p className="text-sm font-medium mt-2 leading-tight">{card.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-ink-400 text-xs mt-10 text-center">
        Estás viendo una copia de solo lectura generada por quien compartió este enlace — no está
        conectada a su colección en vivo.
      </p>
    </div>
  );
}
