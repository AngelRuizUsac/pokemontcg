"use client";

import { useState } from "react";
import { rarityBorderClass } from "@/lib/rarity";
import { buildTcgPlayerSearchUrl } from "@/lib/tcgdex";
import { formatUsd } from "@/lib/currency";
import {
  updateCollectionEntry,
  removeCollectionEntry,
  getAllocatedQuantity,
  getAvailableQuantity,
  getContainersForEntry,
  isEntryBulk,
  entryUnitValueUsd,
} from "@/lib/storage";
import type { CollectionEntry, AppSettings } from "@/lib/storage";
import PriceTicket from "./PriceTicket";
import CardImage from "./CardImage";
import ContainerIcon from "./ContainerIcon";
import CardDetailModal from "./CardDetailModal";

export default function CollectionCard({
  entry,
  settings,
  onChanged,
}: {
  entry: CollectionEntry;
  settings: AppSettings;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(entry.notes ?? "");
  const [editingAsk, setEditingAsk] = useState(false);
  const [askDraft, setAskDraft] = useState(
    entry.askingPriceUsd != null ? String(entry.askingPriceUsd) : ""
  );

  const allocated = getAllocatedQuantity(entry.id);
  const available = getAvailableQuantity(entry.id);
  const bulk = isEntryBulk(entry, settings);
  const locations = showLocations ? getContainersForEntry(entry.id) : [];

  function updateQuantity(delta: number) {
    const next = entry.quantity + delta;
    if (next < 1) return;
    if (next < allocated) {
      alert(
        `No puedes bajar de ${allocated}: esa cantidad ya está asignada a algún binder o mazo. Quítala de ahí primero.`
      );
      return;
    }
    setBusy(true);
    updateCollectionEntry(entry.id, { quantity: next });
    onChanged();
    setBusy(false);
  }

  function remove() {
    if (allocated > 0) {
      alert(
        "Esta carta tiene copias asignadas a un binder o mazo. Quítalas de ahí antes de eliminarla de tu colección."
      );
      return;
    }
    if (!confirm(`¿Quitar ${entry.cardName} de tu colección?`)) return;
    setBusy(true);
    removeCollectionEntry(entry.id);
    onChanged();
    setBusy(false);
  }

  function saveNotes() {
    updateCollectionEntry(entry.id, { notes: notesDraft.trim() || null });
    setEditingNotes(false);
    onChanged();
  }

  function saveAskingPrice() {
    const parsed = askDraft.trim() === "" ? null : Number(askDraft);
    updateCollectionEntry(entry.id, {
      askingPriceUsd: parsed != null && !Number.isNaN(parsed) ? parsed : null,
    });
    setEditingAsk(false);
    onChanged();
  }

  function toggleBulk() {
    updateCollectionEntry(entry.id, { markedBulk: !entry.markedBulk });
    onChanged();
  }

  return (
    <div
      className={`rounded-card border bg-ink-800 p-3 flex flex-col gap-2 ${rarityBorderClass(
        entry.rarity
      )} ${bulk ? "opacity-70" : ""}`}
    >
      <button
        onClick={() => setShowDetail(true)}
        className="relative aspect-[5/7] rounded overflow-hidden bg-ink-900"
        title="Ver detalle de la carta"
      >
        <CardImage src={entry.imageUrl} alt={entry.cardName} sizes="200px" className="object-contain" />
        <span className="absolute top-1.5 right-1.5 bg-ink-900/90 text-ink-50 text-[11px] font-mono px-1.5 py-0.5 rounded">
          x{entry.quantity}
        </span>
        {entry.isHolo && (
          <span className="absolute top-1.5 left-1.5 bg-holo-cyan/90 text-ink-900 text-[10px] font-bold px-1.5 py-0.5 rounded">
            HOLO
          </span>
        )}
        {bulk && (
          <span className="absolute bottom-1.5 left-1.5 bg-ink-900/90 text-ink-400 text-[10px] px-1.5 py-0.5 rounded">
            bulk
          </span>
        )}
      </button>

      <div>
        <p className="font-display font-semibold text-sm leading-tight">{entry.cardName}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <p className="text-ink-400 text-xs">
            {entry.setName} · #{entry.number}
            {entry.setAbbreviation && ` · ${entry.setAbbreviation}`}
          </p>
        </div>
        <p className="text-ink-400 text-[11px] mt-0.5">
          {entry.condition} · {entry.language}
        </p>
        {allocated > 0 && (
          <button
            onClick={() => setShowLocations((s) => !s)}
            className="text-holo-cyan text-[11px] mt-0.5 hover:underline"
          >
            {available} sin asignar · {allocated} en binders/mazos {showLocations ? "▲" : "▼"}
          </button>
        )}
      </div>

      {showLocations && locations.length > 0 && (
        <div className="flex flex-col gap-1 bg-ink-900 rounded p-2">
          {locations.map(({ container, quantity }) => (
            <div key={container.id} className="flex items-center gap-2 text-xs">
              <ContainerIcon image={container.image} size={18} />
              <span className="truncate">{container.name}</span>
              <span className="text-ink-400 font-mono ml-auto">x{quantity}</span>
            </div>
          ))}
        </div>
      )}

      <PriceTicket
        priceUsd={entry.priceUsd == null ? null : entryUnitValueUsd(entry, settings)}
        exchangeRate={settings.exchangeRate}
        tcgPlayerUrl={buildTcgPlayerSearchUrl(entry.cardName, entry.setName)}
        size="sm"
      />
      {entry.condition !== "NM" && entry.priceUsd != null && (
        <p className="text-ink-400 text-[10px] -mt-1">
          ajustado por condición ({entry.condition}), precio de mercado: {entry.priceUsd.toFixed(2)} USD
        </p>
      )}

      {editingAsk ? (
        <div className="flex items-center gap-1">
          <span className="text-ink-400 text-xs">Precio de venta: $</span>
          <input
            autoFocus
            type="number"
            min={0}
            step="0.01"
            value={askDraft}
            onChange={(e) => setAskDraft(e.target.value)}
            placeholder={entry.priceUsd != null ? entry.priceUsd.toFixed(2) : "0.00"}
            className="w-20 bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs font-mono"
          />
          <button onClick={saveAskingPrice} className="text-gold text-xs">
            OK
          </button>
        </div>
      ) : entry.askingPriceUsd != null ? (
        <button
          onClick={() => {
            setAskDraft(String(entry.askingPriceUsd));
            setEditingAsk(true);
          }}
          className="text-left text-holo-pink text-[11px] hover:underline"
        >
          En venta: {formatUsd(entry.askingPriceUsd)}
        </button>
      ) : (
        <button
          onClick={() => setEditingAsk(true)}
          className="text-left text-ink-400 text-[11px] hover:text-ink-100"
        >
          + poner precio de venta
        </button>
      )}

      {editingNotes ? (
        <div className="flex flex-col gap-1">
          <textarea
            autoFocus
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            rows={2}
            className="bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs resize-none"
          />
          <button onClick={saveNotes} className="text-gold text-xs self-end">
            Guardar nota
          </button>
        </div>
      ) : entry.notes ? (
        <button
          onClick={() => {
            setNotesDraft(entry.notes ?? "");
            setEditingNotes(true);
          }}
          className="text-left text-ink-400 text-[11px] italic bg-ink-900 rounded px-2 py-1 hover:text-ink-100"
        >
          📝 {entry.notes}
        </button>
      ) : (
        <button
          onClick={() => setEditingNotes(true)}
          className="text-left text-ink-400 text-[11px] hover:text-ink-100"
        >
          + agregar nota
        </button>
      )}

      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => updateQuantity(-1)}
            disabled={busy || entry.quantity <= 1}
            className="w-6 h-6 rounded-full bg-ink-700 text-ink-100 text-sm disabled:opacity-30"
          >
            −
          </button>
          <span className="font-mono text-sm w-4 text-center">{entry.quantity}</span>
          <button
            onClick={() => updateQuantity(1)}
            disabled={busy}
            className="w-6 h-6 rounded-full bg-ink-700 text-ink-100 text-sm disabled:opacity-30"
          >
            +
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleBulk}
            className={`text-[11px] ${entry.markedBulk ? "text-gold" : "text-ink-400"} hover:text-gold`}
            title="Marcar/desmarcar como bulk"
          >
            bulk
          </button>
          <button
            onClick={remove}
            disabled={busy}
            className="text-danger/80 text-xs hover:text-danger"
          >
            Quitar
          </button>
        </div>
      </div>

      {showDetail && (
        <CardDetailModal
          cardId={entry.cardId}
          exchangeRate={settings.exchangeRate}
          onClose={() => setShowDetail(false)}
        />
      )}
    </div>
  );
}
