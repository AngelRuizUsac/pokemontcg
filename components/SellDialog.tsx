"use client";

import { useState } from "react";
import { sellFromBinder } from "@/lib/storage";
import type { CollectionEntry, Allocation } from "@/lib/storage";
import { formatUsd } from "@/lib/currency";
import CardImage from "./CardImage";

export default function SellDialog({
  entry,
  alloc,
  binderId,
  onClose,
  onSold,
}: {
  entry: CollectionEntry;
  alloc: Allocation;
  binderId: string;
  onClose: () => void;
  onSold: () => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(
    entry.askingPriceUsd != null
      ? String(entry.askingPriceUsd)
      : entry.priceUsd != null
      ? String(entry.priceUsd)
      : ""
  );
  const [buyerNote, setBuyerNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function confirmSale() {
    const priceUsd = Number(price);
    if (!price || Number.isNaN(priceUsd) || priceUsd < 0) {
      setError("Escribe un precio válido.");
      return;
    }
    setSaving(true);
    const result = sellFromBinder(
      binderId,
      entry.id,
      quantity,
      priceUsd,
      buyerNote.trim() || null
    );
    if (!result.ok) {
      setError(result.reason ?? "No se pudo registrar la venta.");
      setSaving(false);
      return;
    }
    onSold();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-ink-800 border border-ink-700 rounded-card max-w-sm w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-3">
          <div className="relative w-14 aspect-[5/7] rounded overflow-hidden bg-ink-900 shrink-0">
            <CardImage src={entry.imageUrl} alt={entry.cardName} className="object-contain" />
          </div>
          <div>
            <p className="font-display font-semibold">{entry.cardName}</p>
            <p className="text-ink-400 text-xs">
              {entry.setName} · #{entry.number}
            </p>
            <p className="text-ink-400 text-xs">Tienes {alloc.quantity} en este binder</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-xs text-ink-400 flex flex-col gap-1">
            Cantidad vendida
            <input
              type="number"
              min={1}
              max={alloc.quantity}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(alloc.quantity, Number(e.target.value))))}
              className="bg-ink-900 border border-ink-700 rounded px-2.5 py-1.5 text-ink-50 font-mono"
            />
          </label>
          <label className="text-xs text-ink-400 flex flex-col gap-1">
            Precio por copia ($)
            <input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="bg-ink-900 border border-ink-700 rounded px-2.5 py-1.5 text-ink-50 font-mono"
            />
          </label>
          <label className="text-xs text-ink-400 flex flex-col gap-1 col-span-2">
            Nota del comprador (opcional)
            <input
              type="text"
              value={buyerNote}
              onChange={(e) => setBuyerNote(e.target.value)}
              placeholder="ej. nombre, Facebook, envío…"
              className="bg-ink-900 border border-ink-700 rounded px-2.5 py-1.5 text-ink-50"
            />
          </label>
        </div>

        {price && !Number.isNaN(Number(price)) && (
          <p className="text-ink-400 text-xs mt-2">
            Total: {formatUsd(Number(price) * quantity)}
          </p>
        )}

        {error && <p className="text-danger text-xs mt-3">{error}</p>}

        <div className="mt-5 flex gap-2 justify-end">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-full text-ink-400 hover:text-ink-50">
            Cancelar
          </button>
          <button
            onClick={confirmSale}
            disabled={saving}
            className="text-sm px-4 py-2 rounded-full bg-grass/10 text-grass border border-grass/30 font-medium hover:bg-grass/20 disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Confirmar venta"}
          </button>
        </div>
      </div>
    </div>
  );
}
