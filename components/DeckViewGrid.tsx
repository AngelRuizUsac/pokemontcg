"use client";

import { useState } from "react";
import type { CollectionEntry, Allocation, WorkSlot, AppSettings, UsedElsewhereLink } from "@/lib/storage";
import { entryUnitValueUsd, getCollectionEntry, getContainer } from "@/lib/storage";
import { formatGtq, usdToGtq } from "@/lib/currency";
import { buildTcgPlayerSearchUrl } from "@/lib/tcgdex";
import CardImage from "./CardImage";
import CardDetailModal from "./CardDetailModal";

interface Row {
  entry: CollectionEntry;
  alloc: Allocation;
}

// Tarjeta de solo lectura para la "vista" de un binder/mazo — mismo espíritu
// visual que la vista compartida, pero con los datos en vivo del navegador,
// sin necesitar generar ni abrir ningún link.
function ViewTile({
  cardId,
  imageUrl,
  name,
  subtitle,
  quantity,
  priceLine,
  askLine,
  dashed,
  exchangeRate,
  clickable = true,
  buySetName,
}: {
  cardId: string;
  imageUrl: string;
  name: string;
  subtitle: string;
  quantity: number;
  priceLine?: string | null;
  askLine?: string | null;
  dashed?: boolean;
  exchangeRate: number;
  clickable?: boolean;
  buySetName?: string;
}) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div
      className={`bg-ink-800 border rounded-card p-3 ${
        dashed ? "border-dashed border-danger/40" : "border-ink-700"
      }`}
    >
      <button
        onClick={() => clickable && setShowDetail(true)}
        className="relative aspect-[5/7] rounded overflow-hidden bg-ink-900 w-full"
        title={clickable ? "Ver detalle de la carta" : undefined}
      >
        <CardImage src={imageUrl} alt={name} sizes="200px" className="object-contain" />
        <span className="absolute top-1.5 right-1.5 bg-ink-900/90 text-ink-50 text-[11px] font-mono px-1.5 py-0.5 rounded">
          x{quantity}
        </span>
      </button>
      <p className="text-sm font-medium mt-2 leading-tight truncate">{name}</p>
      <p className="text-ink-400 text-xs truncate">{subtitle}</p>
      {priceLine && (
        <p className={`text-xs font-mono mt-0.5 ${dashed ? "text-danger" : "text-gold"}`}>
          {priceLine}
        </p>
      )}
      {askLine && <p className="text-holo-pink text-xs font-mono mt-0.5">{askLine}</p>}
      {buySetName && (
        <a
          href={buildTcgPlayerSearchUrl(name, buySetName)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold text-[11px] hover:underline"
        >
          Comprar en TCGPlayer
        </a>
      )}
      {showDetail && (
        <CardDetailModal cardId={cardId} exchangeRate={exchangeRate} onClose={() => setShowDetail(false)} />
      )}
    </div>
  );
}

export default function DeckViewGrid({
  rows,
  energySlots,
  missingSlots,
  usedLinks,
  exchangeRate,
  settings,
  isBinder,
}: {
  rows: Row[];
  energySlots: WorkSlot[];
  missingSlots: WorkSlot[];
  usedLinks: UsedElsewhereLink[];
  exchangeRate: number;
  settings: AppSettings;
  isBinder: boolean;
}) {
  const gridClass = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4";

  const usedElsewhere = usedLinks
    .map((link) => {
      const entry = getCollectionEntry(link.collectionEntryId);
      const holder = getContainer(link.holdingContainerId);
      return entry ? { link, entry, holderName: holder?.name ?? "otro mazo/binder" } : null;
    })
    .filter((item): item is { link: UsedElsewhereLink; entry: CollectionEntry; holderName: string } => item !== null);

  if (rows.length === 0 && energySlots.length === 0 && missingSlots.length === 0 && usedElsewhere.length === 0) {
    return <p className="text-ink-400 text-sm mt-3">Todavía no hay cartas aquí.</p>;
  }

  return (
    <div className="flex flex-col gap-8 mt-4">
      {(rows.length > 0 || energySlots.length > 0) && (
        <div>
          {!isBinder && <h3 className="text-ink-400 text-xs uppercase tracking-wide mb-3">En el mazo</h3>}
          <div className={gridClass}>
            {rows
              .slice()
              .sort((a, b) => a.entry.cardName.localeCompare(b.entry.cardName))
              .map((r) => (
                <ViewTile
                  key={r.alloc.id}
                  cardId={r.entry.cardId}
                  imageUrl={r.entry.imageUrl}
                  name={r.entry.cardName}
                  subtitle={`${r.entry.setName} · #${r.entry.number}`}
                  quantity={r.alloc.quantity}
                  exchangeRate={exchangeRate}
                  priceLine={
                    r.entry.priceUsd != null
                      ? formatGtq(usdToGtq(entryUnitValueUsd(r.entry, settings) * r.alloc.quantity, exchangeRate))
                      : null
                  }
                  askLine={
                    r.entry.askingPriceUsd != null
                      ? `en venta: ${formatGtq(usdToGtq(r.entry.askingPriceUsd * r.alloc.quantity, exchangeRate))}`
                      : null
                  }
                />
              ))}
            {energySlots.map((slot) => (
              <ViewTile
                key={slot.id}
                cardId={slot.cardId}
                imageUrl={slot.imageUrl}
                name={slot.cardName}
                subtitle={slot.isGeneric ? "Energía genérica" : `${slot.setName} · #${slot.number}`}
                quantity={slot.quantity}
                exchangeRate={exchangeRate}
                clickable={!slot.isGeneric}
              />
            ))}
          </div>
        </div>
      )}

      {usedElsewhere.length > 0 && (
        <div>
          <h3 className="text-holo-cyan text-xs uppercase tracking-wide mb-3">Usadas en otro mazo/binder</h3>
          <div className={gridClass}>
            {usedElsewhere.map(({ link, entry, holderName }) => (
              <ViewTile
                key={link.id}
                cardId={entry.cardId}
                imageUrl={entry.imageUrl}
                name={entry.cardName}
                subtitle={`Está en ${holderName}`}
                quantity={link.quantity}
                exchangeRate={exchangeRate}
                priceLine="La tienes · puedes moverla aquí"
              />
            ))}
          </div>
        </div>
      )}

      {missingSlots.length > 0 && (
        <div>
          <h3 className="text-danger text-xs uppercase tracking-wide mb-3">Faltan</h3>
          <div className={gridClass}>
            {missingSlots.map((slot) => (
              <ViewTile
                key={slot.id}
                cardId={slot.cardId}
                imageUrl={slot.imageUrl}
                name={slot.cardName}
                subtitle={`${slot.setName} · #${slot.number}`}
                quantity={slot.quantity}
                exchangeRate={exchangeRate}
                priceLine={
                  slot.priceUsd != null
                    ? `falta · ${formatGtq(usdToGtq(slot.priceUsd * slot.quantity, exchangeRate))}`
                    : "falta"
                }
                buySetName={slot.setName}
                dashed
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
