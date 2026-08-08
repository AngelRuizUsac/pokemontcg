"use client";

import { useState } from "react";
import { getCollection, getAvailableQuantity, replaceWorkSlotWithOwned } from "@/lib/storage";
import type { WorkSlot } from "@/lib/storage";
import CardImage from "./CardImage";

export default function ReplaceWorkSlotDialog({
  slot,
  onClose,
  onReplaced,
}: {
  slot: WorkSlot;
  onClose: () => void;
  onReplaced: () => void;
}) {
  const candidates = getCollection().filter(
    (e) => e.cardName === slot.cardName && getAvailableQuantity(e.id) > 0
  );
  const [error, setError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  function confirm(entryId: string) {
    const qty = Math.min(quantities[entryId] ?? 1, slot.quantity);
    const result = replaceWorkSlotWithOwned(slot.id, entryId, qty);
    if (!result.ok) {
      setError(result.reason ?? "No se pudo hacer el cambio.");
      return;
    }
    onReplaced();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-ink-800 border border-ink-700 rounded-card max-w-sm w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-display font-semibold">Ya la conseguí</p>
        <p className="text-ink-400 text-xs mt-1">
          Cambia copias de "{slot.cardName}" que te faltaban por copias reales que ya tienes.
        </p>

        {candidates.length === 0 ? (
          <p className="text-ink-400 text-sm mt-4">
            Todavía no tienes ninguna copia disponible de esta carta en tu colección.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-2 max-h-64 overflow-y-auto scrollbar-thin">
            {candidates.map((entry) => {
              const available = getAvailableQuantity(entry.id);
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 bg-ink-900 border border-ink-700 rounded-lg p-2"
                >
                  <div className="relative w-10 aspect-[5/7] rounded overflow-hidden bg-ink-800 shrink-0">
                    <CardImage src={entry.imageUrl} alt={entry.cardName} className="object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {entry.setName} · #{entry.number}
                    </p>
                    <p className="text-ink-400 text-xs">{available} disponibles</p>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={Math.min(available, slot.quantity)}
                    value={quantities[entry.id] ?? Math.min(available, slot.quantity)}
                    onChange={(e) =>
                      setQuantities((q) => ({ ...q, [entry.id]: Number(e.target.value) }))
                    }
                    className="w-14 bg-ink-800 border border-ink-700 rounded px-2 py-1 text-sm font-mono"
                  />
                  <button
                    onClick={() => confirm(entry.id)}
                    className="text-xs px-3 py-1.5 rounded-full bg-grass/10 text-grass border border-grass/30 hover:bg-grass/20"
                  >
                    Usar
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {error && <p className="text-danger text-xs mt-3">{error}</p>}

        <button onClick={onClose} className="mt-4 w-full text-sm px-4 py-2 rounded-full text-ink-400 hover:text-ink-50">
          Cerrar
        </button>
      </div>
    </div>
  );
}
