"use client";

import { useState } from "react";
import { getContainers, moveAllocation, moveWorkSlot } from "@/lib/storage";
import type { Container } from "@/lib/storage";
import ContainerIcon from "./ContainerIcon";

type MoveTarget =
  | { kind: "allocation"; id: string; currentContainerId: string; maxQuantity: number }
  | { kind: "workslot"; id: string; currentContainerId: string; maxQuantity: number };

export default function MoveDialog({
  target,
  onClose,
  onMoved,
}: {
  target: MoveTarget;
  onClose: () => void;
  onMoved: () => void;
}) {
  const allContainers = getContainers();
  // los renglones de trabajo solo existen en mazos, así que solo pueden
  // moverse a otro mazo
  const destinations = allContainers.filter(
    (c) =>
      c.id !== target.currentContainerId &&
      (target.kind === "allocation" || c.type === "deck")
  );

  const [destId, setDestId] = useState(destinations[0]?.id ?? "");
  const [quantity, setQuantity] = useState(target.maxQuantity);
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    if (!destId) {
      setError("Elige un binder o mazo destino.");
      return;
    }
    if (target.kind === "allocation") {
      const result = moveAllocation(target.id, destId, quantity);
      if (!result.ok) {
        setError(result.reason ?? "No se pudo mover.");
        return;
      }
    } else {
      moveWorkSlot(target.id, destId);
    }
    onMoved();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-ink-800 border border-ink-700 rounded-card max-w-sm w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-display font-semibold">Mover a otro binder o mazo</p>

        {destinations.length === 0 ? (
          <p className="text-ink-400 text-sm mt-4">
            No tienes otro binder o mazo disponible como destino todavía.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-2 max-h-56 overflow-y-auto scrollbar-thin">
              {destinations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setDestId(c.id)}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-left ${
                    destId === c.id
                      ? "border-gold/60 bg-gold/10"
                      : "border-ink-700 bg-ink-900 hover:border-ink-600"
                  }`}
                >
                  <ContainerIcon image={c.image} size={28} />
                  <span className="text-sm">{c.name}</span>
                  <span className="text-ink-400 text-[10px] ml-auto uppercase">
                    {c.type === "deck" ? "mazo" : "binder"}
                  </span>
                </button>
              ))}
            </div>

            {target.kind === "allocation" && (
              <label className="text-xs text-ink-400 flex flex-col gap-1 mt-4">
                Cantidad a mover (máx. {target.maxQuantity})
                <input
                  type="number"
                  min={1}
                  max={target.maxQuantity}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="bg-ink-900 border border-ink-700 rounded px-2.5 py-1.5 text-ink-50 font-mono"
                />
              </label>
            )}

            {error && <p className="text-danger text-xs mt-3">{error}</p>}

            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={onClose}
                className="text-sm px-4 py-2 rounded-full text-ink-400 hover:text-ink-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirm}
                className="text-sm px-4 py-2 rounded-full bg-gold text-ink-900 font-medium hover:bg-gold-light"
              >
                Mover
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
