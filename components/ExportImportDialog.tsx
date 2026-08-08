"use client";

import { useState } from "react";
import type { Container, Allocation, WorkSlot, CollectionEntry } from "@/lib/storage";
import { getCollection, getAvailableQuantity, allocateToContainer, addWorkSlot } from "@/lib/storage";
import { generateDeckListText, parseDeckListText } from "@/lib/pokemonLiveFormat";
import type { DeckSection } from "@/lib/pokemonLiveFormat";
import { matchDeckListLines } from "@/lib/deckImport";
import { resolveMarketPriceUsd } from "@/lib/types";
import { cardImageUrl, resolveSetCode } from "@/lib/tcgdex";
import { downloadJson } from "@/lib/exportImport";

interface Row {
  entry: CollectionEntry;
  alloc: Allocation;
}

export default function ExportImportDialog({
  container,
  rows,
  workSlots,
  onClose,
  onImported,
}: {
  container: Container;
  rows: Row[];
  workSlots: WorkSlot[];
  onClose: () => void;
  onImported: () => void;
}) {
  const isDeck = container.type === "deck";
  const [tab, setTab] = useState<"export" | "import">("export");
  const [importText, setImportText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function exportDeckText() {
    // combina cartas que ya tienes en el mazo + las que faltan (modo
    // trabajo) en una sola lista, sumando por carta+expansión+número
    const byKey = new Map<
      string,
      { quantity: number; name: string; setCode: string; number: string; section: DeckSection }
    >();

    for (const r of rows) {
      const key = `${r.entry.cardId}`;
      const setCode = r.entry.setAbbreviation ?? r.entry.setId.toUpperCase();
      const number = r.entry.number.replace(/^0+(?=\d)/, "");
      const existing = byKey.get(key);
      if (existing) existing.quantity += r.alloc.quantity;
      else
        byKey.set(key, {
          quantity: r.alloc.quantity,
          name: r.entry.cardName,
          setCode,
          number,
          section: r.entry.category,
        });
    }
    for (const w of workSlots) {
      if (w.isGeneric) continue; // las energías genéricas no tienen impresión real que exportar
      const key = `${w.cardId}`;
      const setCode = w.setAbbreviation ?? w.setId.toUpperCase();
      const number = w.number.replace(/^0+(?=\d)/, "");
      const existing = byKey.get(key);
      if (existing) existing.quantity += w.quantity;
      else
        byKey.set(key, {
          quantity: w.quantity,
          name: w.cardName,
          setCode,
          number,
          section: w.category,
        });
    }

    return generateDeckListText(Array.from(byKey.values()));
  }

  function doExport() {
    if (isDeck) {
      const text = exportDeckText();
      navigator.clipboard.writeText(text).catch(() => {});
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${container.name.replace(/\s+/g, "-").toLowerCase()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      downloadJson(
        `${container.name.replace(/\s+/g, "-").toLowerCase()}.json`,
        rows.map((r) => ({
          cardId: r.entry.cardId,
          cardName: r.entry.cardName,
          setName: r.entry.setName,
          number: r.entry.number,
          quantity: r.alloc.quantity,
          condition: r.entry.condition,
          language: r.entry.language,
          priceUsd: r.entry.priceUsd,
        }))
      );
    }
  }

  async function doImportDeck() {
    setBusy(true);
    setResult(null);
    try {
      const { lines, unrecognized } = parseDeckListText(importText);
      const { matched, unmatched } = await matchDeckListLines(lines);

      let allocated = 0;
      let queuedAsWork = 0;

      for (const { line, card } of matched) {
        const owned = getCollection().filter(
          (e) =>
            (card.category === "Energy" ? e.cardName === card.name : e.cardId === card.id) &&
            getAvailableQuantity(e.id) > 0
        );
        let remaining = line.quantity;
        for (const entry of owned) {
          if (remaining <= 0) break;
          const available = getAvailableQuantity(entry.id);
          const take = Math.min(available, remaining);
          if (take > 0) {
            allocateToContainer(container.id, entry.id, take);
            allocated += take;
            remaining -= take;
          }
        }
        if (remaining > 0) {
          // Siempre se registra lo que falta, sin importar si el modo
          // trabajo está activo — así nada se pierde al importar, y más
          // adelante puede asignarse con "Ya la conseguí" si aparece en tu
          // colección. El modo trabajo solo controla si puedes buscar y
          // agregar manualmente cartas que no tienes desde este mazo.
          addWorkSlot({
            deckId: container.id,
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
            quantity: remaining,
            priceUsd: resolveMarketPriceUsd(card),
            isGeneric: false,
          });
          queuedAsWork += remaining;
        }
      }

      setResult(
        `${allocated} copias asignadas desde tu colección · ${queuedAsWork} agregadas a "cartas que faltan" · ` +
          `${unmatched.length + unrecognized.length} línea(s) sin coincidencia.`
      );
      onImported();
    } finally {
      setBusy(false);
    }
  }

  function doImportBinderFile(file: File) {
    setBusy(true);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const items = JSON.parse(String(reader.result)) as {
          cardId: string;
          quantity: number;
        }[];
        let allocated = 0;
        let skipped = 0;
        for (const item of items) {
          const owned = getCollection().filter(
            (e) => e.cardId === item.cardId && getAvailableQuantity(e.id) > 0
          );
          let remaining = item.quantity;
          for (const entry of owned) {
            if (remaining <= 0) break;
            const available = getAvailableQuantity(entry.id);
            const take = Math.min(available, remaining);
            if (take > 0) {
              allocateToContainer(container.id, entry.id, take);
              allocated += take;
              remaining -= take;
            }
          }
          if (remaining > 0) skipped += remaining;
        }
        setResult(`${allocated} copias asignadas · ${skipped} sin poder asignar (no las tienes disponibles).`);
        onImported();
      } catch {
        setResult("El archivo no tiene un formato válido.");
      } finally {
        setBusy(false);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-ink-800 border border-ink-700 rounded-card max-w-lg w-full p-5 max-h-[85vh] overflow-y-auto scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-display font-semibold">Exportar / Importar</p>
          <button onClick={onClose} className="text-ink-400 text-sm hover:text-ink-50">
            Cerrar
          </button>
        </div>

        <div className="flex gap-1 mt-3 bg-ink-900 rounded-full p-1 w-fit">
          <button
            onClick={() => setTab("export")}
            className={`text-xs px-3 py-1.5 rounded-full ${tab === "export" ? "bg-ink-700 text-ink-50" : "text-ink-400"}`}
          >
            Exportar
          </button>
          <button
            onClick={() => setTab("import")}
            className={`text-xs px-3 py-1.5 rounded-full ${tab === "import" ? "bg-ink-700 text-ink-50" : "text-ink-400"}`}
          >
            Importar
          </button>
        </div>

        {tab === "export" ? (
          <div className="mt-4">
            {isDeck ? (
              <>
                <p className="text-ink-400 text-xs mb-2">
                  Formato de texto de Pokémon TCG Live (incluye cartas que ya tienes y las que faltan).
                </p>
                <pre className="bg-ink-900 border border-ink-700 rounded p-3 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto scrollbar-thin">
                  {exportDeckText() || "(este mazo está vacío)"}
                </pre>
              </>
            ) : (
              <p className="text-ink-400 text-xs mb-2">
                Se descargará un archivo JSON con el inventario de este binder.
              </p>
            )}
            <button
              onClick={doExport}
              className="mt-3 w-full px-4 py-2.5 rounded-full bg-gold text-ink-900 text-sm font-medium hover:bg-gold-light"
            >
              {isDeck ? "Copiar y descargar .txt" : "Descargar .json"}
            </button>
          </div>
        ) : (
          <div className="mt-4">
            {isDeck ? (
              <>
                <p className="text-ink-400 text-xs mb-2">
                  Pega una lista en formato Pokémon TCG Live. Las cartas que ya tienes disponibles se
                  asignan a este mazo; el resto se agrega a "cartas que faltan" si el modo trabajo está
                  activo.
                </p>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={8}
                  placeholder={"Pokémon: 19\n4 Dreepy TWM 128\n…"}
                  className="w-full bg-ink-900 border border-ink-700 rounded p-3 text-xs font-mono resize-none"
                />
                <button
                  onClick={doImportDeck}
                  disabled={busy || !importText.trim()}
                  className="mt-3 w-full px-4 py-2.5 rounded-full bg-gold text-ink-900 text-sm font-medium hover:bg-gold-light disabled:opacity-50"
                >
                  {busy ? "Importando…" : "Importar lista"}
                </button>
              </>
            ) : (
              <>
                <p className="text-ink-400 text-xs mb-2">
                  Sube un archivo JSON exportado desde otro binder. Solo se asignan cartas que ya tengas
                  disponibles en tu colección.
                </p>
                <input
                  type="file"
                  accept="application/json"
                  onChange={(e) => e.target.files?.[0] && doImportBinderFile(e.target.files[0])}
                  className="text-xs text-ink-400"
                />
              </>
            )}
            {result && <p className="text-ink-100 text-xs mt-3">{result}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
