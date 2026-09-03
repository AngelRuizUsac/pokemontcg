"use client";

import { useState } from "react";
import {
  getCollection,
  getAvailableQuantity,
  allocateToContainer,
  addWorkSlot,
} from "@/lib/storage";
import type { CollectionEntry } from "@/lib/storage";
import { searchCards, getCardById, cardImageUrl, resolveSetCode } from "@/lib/tcgdex";
import { resolveMarketPriceUsd } from "@/lib/types";
import type { PokemonCard } from "@/lib/types";
import { CARD_TYPE_OPTIONS, matchesCardTypeFilter } from "@/lib/cardTypeFilter";
import { GENERIC_BASIC_ENERGIES } from "@/lib/genericEnergy";
import { computeEffectSignature } from "@/lib/reprints";
import CardImage from "./CardImage";

export default function AddCardDialog({
  containerId,
  isDeck,
  allowWork,
  onClose,
  onAdded,
}: {
  containerId: string;
  isDeck: boolean;
  allowWork: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [mode, setMode] = useState<"owned" | "work" | "energy">("owned");
  const [term, setTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [ownedResults, setOwnedResults] = useState<CollectionEntry[]>([]);
  const [workResults, setWorkResults] = useState<PokemonCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  function runOwnedSearch() {
    const q = term.trim().toLowerCase();
    const results = getCollection()
      .filter((e) => getAvailableQuantity(e.id) > 0)
      .filter((e) => !q || e.cardName.toLowerCase().includes(q))
      .filter((e) => matchesCardTypeFilter(typeFilter, e.category, e.trainerType, e.energyType))
      .sort((a, b) => a.cardName.localeCompare(b.cardName));
    setOwnedResults(results);
  }

  async function runWorkSearch() {
    if (!term.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const briefs = await searchCards(term.trim());
      let detailed = await Promise.all(briefs.map((b) => getCardById(b.id)));
      if (typeFilter) {
        detailed = detailed.filter((c) =>
          matchesCardTypeFilter(typeFilter, c.category, c.trainerType, c.energyType)
        );
      }
      setWorkResults(detailed);
    } catch {
      setError("No se pudo buscar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  function addOwned(entry: CollectionEntry) {
    const qty = quantities[entry.id] || 1;
    const result = allocateToContainer(containerId, entry.id, qty);
    if (!result.ok) {
      setError(result.reason ?? "No se pudo asignar la carta.");
      return;
    }
    onAdded();
  }

  function addWork(card: PokemonCard) {
    const qty = quantities[card.id] || 1;
    addWorkSlot({
      deckId: containerId,
      cardId: card.id,
      cardName: card.name,
      category: card.category,
      trainerType: card.trainerType ?? null,
      energyType: card.energyType ?? null,
      setId: card.set.id,
      setName: card.set.name,
      setAbbreviation: resolveSetCode(card.set),
      number: card.localId,
      regulationMark: card.regulationMark ?? null,
      imageUrl: cardImageUrl(card.image, "low", "webp"),
      quantity: qty,
      priceUsd: resolveMarketPriceUsd(card),
      isGeneric: false,
      effectSignature: computeEffectSignature(card),
    });
    onAdded();
  }

  function addGenericEnergy(energyId: string, name: string) {
    const qty = quantities[energyId] || 1;
    addWorkSlot({
      deckId: containerId,
      cardId: energyId,
      cardName: name,
      category: "Energy",
      trainerType: null,
      energyType: "Basic",
      setId: "",
      setName: "Energía básica genérica",
      setAbbreviation: null,
      number: "",
      regulationMark: null,
      imageUrl: "",
      quantity: qty,
      priceUsd: 0,
      isGeneric: true,
      effectSignature: null,
    });
    onAdded();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-ink-800 border border-ink-700 rounded-card max-w-lg w-full p-5 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-display font-semibold">Agregar cartas</p>
          <button onClick={onClose} className="text-ink-400 text-sm hover:text-ink-50">
            Cerrar
          </button>
        </div>

        <div className="flex gap-1 mt-3 bg-ink-900 rounded-full p-1 w-fit flex-wrap">
          <button
            onClick={() => setMode("owned")}
            className={`text-xs px-3 py-1.5 rounded-full ${
              mode === "owned" ? "bg-ink-700 text-ink-50" : "text-ink-400"
            }`}
          >
            De mi colección
          </button>
          {allowWork && (
            <button
              onClick={() => setMode("work")}
              className={`text-xs px-3 py-1.5 rounded-full ${
                mode === "work" ? "bg-ink-700 text-ink-50" : "text-ink-400"
              }`}
            >
              Cualquier carta (trabajo)
            </button>
          )}
          {isDeck && (
            <button
              onClick={() => setMode("energy")}
              className={`text-xs px-3 py-1.5 rounded-full ${
                mode === "energy" ? "bg-ink-700 text-ink-50" : "text-ink-400"
              }`}
            >
              Energía básica
            </button>
          )}
        </div>

        {mode !== "energy" && (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mode === "owned" ? runOwnedSearch() : runWorkSearch();
              }}
              className="mt-4 flex gap-2"
            >
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Nombre de la carta…"
                className="flex-1 bg-ink-900 border border-ink-700 rounded-full px-4 py-2 text-sm outline-none focus:border-gold/60"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-full bg-gold text-ink-900 text-sm font-medium hover:bg-gold-light"
              >
                Buscar
              </button>
            </form>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="mt-2 bg-ink-900 border border-ink-700 rounded px-2 py-1.5 text-xs w-fit"
            >
              {CARD_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            {mode === "owned" && !term && ownedResults.length === 0 && (
              <p className="text-ink-400 text-xs mt-2">
                Deja el campo vacío y presiona "Buscar" para ver toda tu colección
                disponible, o escribe un nombre para filtrar.
              </p>
            )}
          </>
        )}

        {loading && <p className="text-ink-400 text-sm mt-4">Buscando…</p>}
        {error && <p className="text-danger text-sm mt-4">{error}</p>}

        <div className="mt-4 overflow-y-auto scrollbar-thin flex-1 flex flex-col gap-2">
          {mode === "owned" &&
            ownedResults.map((entry) => {
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
                    <p className="text-sm font-medium truncate">
                      {entry.cardName}
                      {entry.isHolo && <span className="text-holo-cyan text-[10px] ml-1">HOLO</span>}
                    </p>
                    <p className="text-ink-400 text-xs">
                      {entry.setName} · #{entry.number} · {available} disponibles
                    </p>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={available}
                    value={quantities[entry.id] ?? 1}
                    onChange={(e) =>
                      setQuantities((q) => ({ ...q, [entry.id]: Number(e.target.value) }))
                    }
                    className="w-14 bg-ink-800 border border-ink-700 rounded px-2 py-1 text-sm font-mono"
                  />
                  <button
                    onClick={() => addOwned(entry)}
                    className="text-xs px-3 py-1.5 rounded-full bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20"
                  >
                    Agregar
                  </button>
                </div>
              );
            })}

          {mode === "work" &&
            workResults.map((card) => (
              <div
                key={card.id}
                className="flex items-center gap-3 bg-ink-900 border border-ink-700 rounded-lg p-2"
              >
                <div className="relative w-10 aspect-[5/7] rounded overflow-hidden bg-ink-800 shrink-0">
                  <CardImage
                    src={cardImageUrl(card.image, "low", "webp")}
                    alt={card.name}
                    className="object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{card.name}</p>
                  <p className="text-ink-400 text-xs">
                    {card.set.name} · #{card.localId}
                  </p>
                </div>
                <input
                  type="number"
                  min={1}
                  value={quantities[card.id] ?? 1}
                  onChange={(e) =>
                    setQuantities((q) => ({ ...q, [card.id]: Number(e.target.value) }))
                  }
                  className="w-14 bg-ink-800 border border-ink-700 rounded px-2 py-1 text-sm font-mono"
                />
                <button
                  onClick={() => addWork(card)}
                  className="text-xs px-3 py-1.5 rounded-full bg-holo-cyan/10 text-holo-cyan border border-holo-cyan/30 hover:bg-holo-cyan/20"
                >
                  Agregar
                </button>
              </div>
            ))}

          {mode === "energy" && (
            <>
              <p className="text-ink-400 text-xs">
                Estas energías no se descuentan de tu colección ni cuentan en el valor de
                cartas faltantes — cualquier jugador tiene acceso a las que necesite.
              </p>
              {GENERIC_BASIC_ENERGIES.map((energy) => (
                <div
                  key={energy.id}
                  className="flex items-center gap-3 bg-ink-900 border border-ink-700 rounded-lg p-2"
                >
                  <div
                    className="w-8 h-8 rounded-full shrink-0"
                    style={{ backgroundColor: energy.color }}
                  />
                  <p className="flex-1 text-sm font-medium">{energy.name}</p>
                  <input
                    type="number"
                    min={1}
                    value={quantities[energy.id] ?? 1}
                    onChange={(e) =>
                      setQuantities((q) => ({ ...q, [energy.id]: Number(e.target.value) }))
                    }
                    className="w-14 bg-ink-800 border border-ink-700 rounded px-2 py-1 text-sm font-mono"
                  />
                  <button
                    onClick={() => addGenericEnergy(energy.id, energy.name)}
                    className="text-xs px-3 py-1.5 rounded-full bg-grass/10 text-grass border border-grass/30 hover:bg-grass/20"
                  >
                    Agregar
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
