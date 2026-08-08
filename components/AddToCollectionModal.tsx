"use client";

import { useState } from "react";
import type { PokemonCard } from "@/lib/types";
import { resolveMarketPriceUsd } from "@/lib/types";
import { cardImageUrl, resolveSetCode, buildTcgPlayerSearchUrl } from "@/lib/tcgdex";
import { addOrMergeToCollection } from "@/lib/storage";
import { computeEffectSignature } from "@/lib/reprints";
import CardImage from "./CardImage";

const CONDITIONS = [
  { value: "NM", label: "Casi nueva (NM)" },
  { value: "LP", label: "Ligero desgaste (LP)" },
  { value: "MP", label: "Desgaste moderado (MP)" },
  { value: "HP", label: "Muy desgastada (HP)" },
  { value: "DMG", label: "Dañada (DMG)" },
];

export default function AddToCollectionModal({
  card,
  onClose,
  onSaved,
}: {
  card: PokemonCard;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState("NM");
  const [language, setLanguage] = useState("EN");
  const [notes, setNotes] = useState("");
  const [isHolo, setIsHolo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mergedMsg, setMergedMsg] = useState<string | null>(null);

  const priceUsd = resolveMarketPriceUsd(card);
  const imageUrl = cardImageUrl(card.image, "low", "webp");

  function handleSave() {
    setSaving(true);
    const { merged } = addOrMergeToCollection({
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
      imageUrl,
      tcgPlayerUrl: buildTcgPlayerSearchUrl(card.name, card.set.name),
      quantity,
      condition,
      language,
      isHolo,
      notes: notes || null,
      markedBulk: false,
      priceUsd,
      priceUpdatedAt: priceUsd != null ? new Date().toISOString() : null,
      effectSignature: computeEffectSignature(card),
    });

    if (merged) {
      setMergedMsg("Ya tenías esta carta (misma condición/idioma/holo) — se sumó la cantidad.");
      setSaving(false);
      setTimeout(onSaved, 700);
    } else {
      onSaved();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-ink-800 border border-ink-700 rounded-card max-w-md w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-4">
          <div className="relative w-20 aspect-[5/7] rounded overflow-hidden bg-ink-900 shrink-0">
            <CardImage src={imageUrl} alt={card.name} className="object-contain" />
          </div>
          <div>
            <p className="font-display font-semibold">{card.name}</p>
            <p className="text-ink-400 text-sm">
              {card.set.name} · #{card.localId}
            </p>
            {card.rarity && <p className="text-ink-400 text-xs mt-1">{card.rarity}</p>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <label className="text-xs text-ink-400 flex flex-col gap-1">
            Cantidad
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="bg-ink-900 border border-ink-700 rounded px-2.5 py-1.5 text-ink-50 font-mono"
            />
          </label>

          <label className="text-xs text-ink-400 flex flex-col gap-1">
            Idioma
            <input
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value.toUpperCase())}
              placeholder="EN, ES, JP…"
              className="bg-ink-900 border border-ink-700 rounded px-2.5 py-1.5 text-ink-50 font-mono"
            />
          </label>

          <label className="text-xs text-ink-400 flex flex-col gap-1 col-span-2">
            Condición
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="bg-ink-900 border border-ink-700 rounded px-2.5 py-1.5 text-ink-50"
            >
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-ink-100 col-span-2">
            <input
              type="checkbox"
              checked={isHolo}
              onChange={(e) => setIsHolo(e.target.checked)}
              className="accent-gold"
            />
            Es holográfica (solo se agrupa con otras copias holo)
          </label>

          <label className="text-xs text-ink-400 flex flex-col gap-1 col-span-2">
            Notas (opcional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="bg-ink-900 border border-ink-700 rounded px-2.5 py-1.5 text-ink-50 resize-none"
            />
          </label>
        </div>

        {mergedMsg && <p className="text-holo-cyan text-xs mt-3">{mergedMsg}</p>}

        <div className="mt-5 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-full text-ink-400 hover:text-ink-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm px-4 py-2 rounded-full bg-gold text-ink-900 font-medium hover:bg-gold-light disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar en mi colección"}
          </button>
        </div>
      </div>
    </div>
  );
}
