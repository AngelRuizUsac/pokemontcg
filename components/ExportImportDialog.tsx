"use client";

import { useState } from "react";
import type { Container, Allocation, WorkSlot, CollectionEntry } from "@/lib/storage";
import {
  getCollection,
  getAvailableQuantity,
  allocateToContainer,
  addWorkSlot,
  getAllocations,
  createUsedElsewhereLink,
} from "@/lib/storage";
import { generateDeckListText, parseDeckListText } from "@/lib/pokemonLiveFormat";
import type { DeckSection } from "@/lib/pokemonLiveFormat";
import { matchDeckListLines } from "@/lib/deckImport";
import { resolveMarketPriceUsd } from "@/lib/types";
import { cardImageUrl, resolveSetCode } from "@/lib/tcgdex";
import { downloadJson } from "@/lib/exportImport";
import { GENERIC_BASIC_ENERGIES } from "@/lib/genericEnergy";
import { computeEffectSignature, effectSignaturesMatch, normalizeCardName } from "@/lib/reprints";

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

      // Las energías básicas (Grass/Fire/Water/…) se registran directo como
      // genéricas — no importa qué expansión traía la línea, cualquier
      // energía básica sirve igual y no cuenta como "falta comprar". Las
      // energías especiales sí son cartas puntuales, así que siguen el
      // proceso normal de búsqueda/emparejamiento.
      const basicEnergyLines = lines.filter(
        (l) =>
          l.section === "Energy" &&
          GENERIC_BASIC_ENERGIES.some((g) => g.name.toLowerCase() === l.name.trim().toLowerCase())
      );
      const otherLines = lines.filter((l) => !basicEnergyLines.includes(l));

      let genericAdded = 0;
      for (const line of basicEnergyLines) {
        const generic = GENERIC_BASIC_ENERGIES.find(
          (g) => g.name.toLowerCase() === line.name.trim().toLowerCase()
        )!;
        addWorkSlot({
          deckId: container.id,
          cardId: generic.id,
          cardName: generic.name,
          category: "Energy",
          trainerType: null,
          energyType: "Basic",
          setId: "",
          setName: "Energía básica genérica",
          setAbbreviation: null,
          number: "",
          regulationMark: null,
          imageUrl: "",
          quantity: line.quantity,
          priceUsd: 0,
          isGeneric: true,
          effectSignature: null,
        });
        genericAdded += line.quantity;
      }

      const { matched, unmatched } = await matchDeckListLines(otherLines);

      let allocated = 0;
      let usedElsewhere = 0;
      let queuedAsWork = 0;

      for (const { line, card } of matched) {
        const importedSignature = computeEffectSignature(card);
        const matchesCard = (entry: CollectionEntry) => {
          if (
            entry.category !== card.category ||
            normalizeCardName(entry.cardName) !== normalizeCardName(card.name)
          ) return false;
          if (card.category !== "Pokemon") return true;
          return entry.cardId === card.id || effectSignaturesMatch(importedSignature, entry.effectSignature);
        };

        let remaining = line.quantity;

        // 1) primero, copias ya disponibles (incluye binders "de utilidad")
        const owned = getCollection().filter((e) => matchesCard(e) && getAvailableQuantity(e.id) > 0);
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

        // 2) si falta, busca si ya la tienes pero está en otro binder/mazo —
        // en vez de marcarla como "falta comprar", se deja un vínculo con
        // opción de "Mover aquí" (no borra el espacio en el otro lado).
        if (remaining > 0) {
          const ownedEntryIds = new Set(getCollection().filter(matchesCard).map((e) => e.id));
          const elsewhere = getAllocations().filter(
            (a) => ownedEntryIds.has(a.collectionEntryId) && a.containerId !== container.id
          );
          for (const alloc of elsewhere) {
            if (remaining <= 0) break;
            const take = Math.min(alloc.quantity, remaining);
            if (take > 0) {
              createUsedElsewhereLink(container.id, alloc.containerId, alloc.collectionEntryId, take);
              usedElsewhere += take;
              remaining -= take;
            }
          }
        }

        // 3) lo que siga faltando, sí es una compra pendiente real
        if (remaining > 0) {
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
            effectSignature: computeEffectSignature(card),
          });
          queuedAsWork += remaining;
        }
      }

      setResult(
        `${allocated} copias asignadas · ${genericAdded} energías básicas genéricas · ` +
          `${usedElsewhere} marcadas como "usadas en otro mazo/binder" · ${queuedAsWork} agregadas a "cartas que faltan" · ` +
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
                  asignan a este mazo; las energías básicas se registran como genéricas sin importar
                  la expansión; si una carta ya la tienes pero está en otro binder/mazo, se marca
                  como "usada ahí" con la opción de moverla; el resto se agrega a "cartas que faltan".
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
