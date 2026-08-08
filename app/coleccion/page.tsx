"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  getContainer,
  updateContainer,
  removeContainer,
  getAllocationsForContainer,
  getWorkSlotsForDeck,
  getCollectionEntry,
  setAllocationQuantity,
  allocateToContainer,
  removeAllocation,
  updateWorkSlot,
  removeWorkSlot,
  getDeckMissingValueUsd,
  refreshWorkSlots,
  getSettings,
  isEntryBulk,
} from "@/lib/storage";
import type { Container, Allocation, WorkSlot, CollectionEntry } from "@/lib/storage";
import { deckGroupKey } from "@/lib/reprints";
import { formatGtq, formatUsd, usdToGtq, DEFAULT_EXCHANGE_RATE } from "@/lib/currency";
import { CARD_TYPE_OPTIONS, matchesCardTypeFilter } from "@/lib/cardTypeFilter";
import ContainerIcon from "@/components/ContainerIcon";
import ContainerImagePicker from "@/components/ContainerImagePicker";
import AddCardDialog from "@/components/AddCardDialog";
import MoveDialog from "@/components/MoveDialog";
import ExportImportDialog from "@/components/ExportImportDialog";
import ReplaceWorkSlotDialog from "@/components/ReplaceWorkSlotDialog";
import CardImage from "@/components/CardImage";
import DeckViewGrid from "@/components/DeckViewGrid";
import DeckLegalityPanel from "@/components/DeckLegalityPanel";
import CardDetailModal from "@/components/CardDetailModal";
import { checkDeckLegality, refineRegulationViolations } from "@/lib/deckLegality";
import type { RegulationViolation } from "@/lib/deckLegality";
import { buildTcgPlayerSearchUrl } from "@/lib/tcgdex";
import { buildShareUrl } from "@/lib/share";

interface Row {
  entry: CollectionEntry;
  alloc: Allocation;
}

interface DeckGroup {
  key: string;
  cardName: string;
  totalQty: number;
  rows: Row[];
}

export default function ColeccionDetailPage() {
  const [containerId, setContainerId] = useState<string | null>(null);

  useEffect(() => {
    setContainerId(new URLSearchParams(window.location.search).get("id"));
  }, []);

  const [container, setContainer] = useState<Container | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [workSlots, setWorkSlots] = useState<WorkSlot[]>([]);
  const [exchangeRate, setExchangeRate] = useState(DEFAULT_EXCHANGE_RATE);
  const [showAdd, setShowAdd] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showExportImport, setShowExportImport] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [replaceTarget, setReplaceTarget] = useState<WorkSlot | null>(null);
  const [moveTarget, setMoveTarget] = useState<
    | { kind: "allocation"; id: string; currentContainerId: string; maxQuantity: number }
    | { kind: "workslot"; id: string; currentContainerId: string; maxQuantity: number }
    | null
  >(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"view" | "build">("view");
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  const [refinedViolations, setRefinedViolations] = useState<RegulationViolation[] | null>(null);
  const [checkingReprints, setCheckingReprints] = useState(false);

  const load = useCallback(() => {
    if (!containerId) return;
    const c = getContainer(containerId) ?? null;
    setContainer(c);
    const allocs = getAllocationsForContainer(containerId);
    const built: Row[] = allocs
      .map((alloc) => {
        const entry = getCollectionEntry(alloc.collectionEntryId);
        return entry ? { entry, alloc } : null;
      })
      .filter((r): r is Row => r !== null);
    setRows(built);
    setWorkSlots(getWorkSlotsForDeck(containerId));
    setExchangeRate(getSettings().exchangeRate);
  }, [containerId]);

  useEffect(() => {
    load();
  }, [load]);

  // Segunda pasada: revisa contra TCGdex si las cartas Trainer/Energy fuera
  // de rango tienen alguna reimpresión vigente (ver lib/deckLegality.ts).
  const legalityKey =
    container?.type === "deck"
      ? JSON.stringify(
          checkDeckLegality(rows, workSlots, getSettings()).regulationViolations
        )
      : "";

  useEffect(() => {
    if (container?.type !== "deck") {
      setRefinedViolations(null);
      return;
    }
    const violations = checkDeckLegality(rows, workSlots, getSettings()).regulationViolations;
    if (violations.length === 0) {
      setRefinedViolations([]);
      return;
    }
    let cancelled = false;
    setCheckingReprints(true);
    refineRegulationViolations(violations, getSettings()).then((filtered) => {
      if (!cancelled) {
        setRefinedViolations(filtered);
        setCheckingReprints(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legalityKey, container?.type]);

  if (!containerId) return null;
  if (!container) {
    return <p className="text-ink-400">No se encontró esta colección.</p>;
  }

  const isDeck = container.type === "deck";
  const missingUsd = isDeck ? getDeckMissingValueUsd(container.id) : 0;
  const fullSettings = getSettings();
  // Las cartas marcadas/clasificadas como bulk no suman al valor del binder/mazo.
  const ownedUsd = rows
    .filter((r) => !isEntryBulk(r.entry, fullSettings))
    .reduce((sum, r) => sum + (r.entry.priceUsd ?? 0) * r.alloc.quantity, 0);
  const legality = isDeck ? checkDeckLegality(rows, workSlots, fullSettings) : null;
  const displayedLegality =
    legality && refinedViolations
      ? { ...legality, regulationViolations: refinedViolations }
      : legality;

  const visibleRows = rows.filter((r) =>
    matchesCardTypeFilter(typeFilter, r.entry.category, r.entry.trainerType, r.entry.energyType)
  );
  const visibleWorkSlots = workSlots.filter((w) =>
    matchesCardTypeFilter(typeFilter, w.category, w.trainerType, w.energyType)
  );
  // Las energías (genéricas o no) se muestran junto con las cartas del mazo
  // y cuentan en el total de cartas; solo Pokémon/Trainer que faltan van en
  // la sección de "cartas que faltan".
  const energySlots = visibleWorkSlots.filter((w) => w.category === "Energy");
  const missingSlots = visibleWorkSlots.filter((w) => w.category !== "Energy");

  const deckGroups: DeckGroup[] = [];
  if (isDeck) {
    const map = new Map<string, DeckGroup>();
    for (const row of visibleRows) {
      const key = deckGroupKey(row.entry);
      const g = map.get(key);
      if (g) {
        g.totalQty += row.alloc.quantity;
        g.rows.push(row);
      } else {
        map.set(key, {
          key,
          cardName: row.entry.cardName,
          totalQty: row.alloc.quantity,
          rows: [row],
        });
      }
    }
    deckGroups.push(...Array.from(map.values()).sort((a, b) => a.cardName.localeCompare(b.cardName)));
  }

  function saveName() {
    const name = nameDraft.trim();
    if (name) updateContainer(container!.id, { name });
    setEditingName(false);
    load();
  }

  function deleteContainer() {
    if (!confirm(`¿Eliminar "${container!.name}"? Las cartas volverán a estar disponibles sin asignar.`)) return;
    removeContainer(container!.id);
    window.location.href = "/colecciones/";
  }

  function adjustAllocQty(row: Row, delta: number) {
    if (delta > 0) {
      allocateToContainer(container!.id, row.entry.id, 1);
    } else {
      setAllocationQuantity(row.alloc.id, row.alloc.quantity - 1);
    }
    load();
  }

  function adjustWorkQty(slot: WorkSlot, delta: number) {
    updateWorkSlot(slot.id, { quantity: slot.quantity + delta });
    load();
  }

  function runRefresh() {
    const { resolved } = refreshWorkSlots(container!.id);
    setRefreshMsg(
      resolved > 0
        ? `Se asignaron ${resolved} copia(s) que ya tenías en tu colección.`
        : "No encontré cartas nuevas disponibles en tu colección todavía."
    );
    load();
    setTimeout(() => setRefreshMsg(null), 4000);
  }

  function share() {
    setShareUrl(
      buildShareUrl({
        v: 1,
        type: container!.type,
        name: container!.name,
        image: container!.image,
        items: rows.map((r) => ({ cardId: r.entry.cardId, quantity: r.alloc.quantity })),
        missing: workSlots.filter((w) => w.category !== "Energy").map((w) => ({ cardId: w.cardId, quantity: w.quantity })),
      })
    );
  }

  const candidateImages = Array.from(
    new Map<string, string>(rows.map((r) => [r.entry.imageUrl, r.entry.cardName])).entries()
  ).map(([url, label]) => ({ url, label }));

  return (
    <div>
      <Link href="/colecciones/" className="text-ink-400 text-sm hover:text-ink-50">
        ← Colecciones
      </Link>

      <div className="mt-3 flex items-start gap-4 flex-wrap">
        <button onClick={() => setShowImagePicker(true)} title="Cambiar imagen">
          <ContainerIcon image={container.image} size={64} />
        </button>

        <div className="flex-1 min-w-[200px]">
          {editingName ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                className="bg-ink-800 border border-ink-700 rounded px-2 py-1 font-display font-bold text-xl"
              />
              <button onClick={saveName} className="text-gold text-sm">
                Guardar
              </button>
            </div>
          ) : (
            <h1
              className="font-display font-bold text-2xl cursor-pointer"
              onClick={() => {
                setNameDraft(container.name);
                setEditingName(true);
              }}
            >
              {container.name}
            </h1>
          )}
          <p className="text-ink-400 text-sm mt-1">
            {isDeck ? "Mazo" : "Binder"} ·{" "}
            {rows.reduce((s, r) => s + r.alloc.quantity, 0) +
              (isDeck ? workSlots.filter((w) => w.category === "Energy").reduce((s, w) => s + w.quantity, 0) : 0)}{" "}
            cartas
            {isDeck &&
              ` · ${workSlots.filter((w) => w.category !== "Energy").reduce((s, w) => s + w.quantity, 0)} faltantes`}
          </p>

          {isDeck && (
            <label className="flex items-center gap-2 mt-2 text-xs text-ink-400">
              <input
                type="checkbox"
                checked={container.workMode}
                onChange={(e) => {
                  updateContainer(container.id, { workMode: e.target.checked });
                  load();
                }}
                className="accent-gold"
              />
              Modo trabajo (permite agregar cartas que no tengo)
            </label>
          )}
        </div>

        <div className="flex flex-col gap-2 items-end">
          {ownedUsd > 0 && (
            <div className="bg-ink-800 border border-ink-700 rounded-card px-3 py-2 text-right">
              <p className="text-ink-400 text-[10px] uppercase tracking-wide">Valor</p>
              <p className="font-mono text-sm text-gold">{formatGtq(usdToGtq(ownedUsd, exchangeRate))}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="text-xs px-3 py-1.5 rounded-full bg-gold text-ink-900 font-medium hover:bg-gold-light"
            >
              + Agregar cartas
            </button>
            <button
              onClick={() => setShowExportImport(true)}
              className="text-xs px-3 py-1.5 rounded-full bg-ink-700 text-ink-100 hover:bg-ink-600"
            >
              Exportar / Importar
            </button>
            {isDeck && (
              <button
                onClick={runRefresh}
                className="text-xs px-3 py-1.5 rounded-full bg-ink-700 text-ink-100 hover:bg-ink-600"
                title="Revisa si alguna carta que falta ya está disponible en tu colección"
              >
                ↻ Actualizar
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-ink-900 rounded-full p-1">
              <button
                onClick={() => setViewMode("view")}
                className={`text-xs px-3 py-1 rounded-full ${
                  viewMode === "view" ? "bg-ink-700 text-ink-50" : "text-ink-400"
                }`}
              >
                Vista
              </button>
              <button
                onClick={() => setViewMode("build")}
                className={`text-xs px-3 py-1 rounded-full ${
                  viewMode === "build" ? "bg-ink-700 text-ink-50" : "text-ink-400"
                }`}
              >
                Construcción
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={share} className="text-xs text-ink-400 hover:text-ink-50">
              Compartir (vista)
            </button>
            <button onClick={deleteContainer} className="text-xs text-danger/80 hover:text-danger">
              Eliminar
            </button>
          </div>
        </div>
      </div>

      {refreshMsg && (
        <div className="mt-4 bg-holo-cyan/10 border border-holo-cyan/30 rounded-card px-4 py-2.5">
          <p className="text-holo-cyan text-sm">{refreshMsg}</p>
        </div>
      )}

      {shareUrl && (
        <div className="mt-4 bg-ink-800 border border-ink-700 rounded-card p-3 flex items-center gap-2">
          <input
            readOnly
            value={shareUrl}
            className="flex-1 bg-ink-900 border border-ink-700 rounded px-2 py-1.5 text-xs font-mono text-ink-100"
            onFocus={(e) => e.target.select()}
          />
          <button
            onClick={() => navigator.clipboard.writeText(shareUrl)}
            className="text-xs px-3 py-1.5 rounded-full bg-gold/10 text-gold border border-gold/30"
          >
            Copiar
          </button>
        </div>
      )}

      {isDeck && missingUsd > 0 && (
        <div className="mt-4 bg-danger/10 border border-danger/30 rounded-card px-4 py-3">
          <p className="text-danger text-sm font-medium">
            Te faltan {formatGtq(usdToGtq(missingUsd, exchangeRate))} ({formatUsd(missingUsd)}) en cartas para
            completar este mazo.
          </p>
        </div>
      )}

      {legality && (
        <DeckLegalityPanel result={displayedLegality!} checkingReprints={checkingReprints} />
      )}

      {viewMode === "view" && (
        <div className="mt-6">
          <DeckViewGrid
            rows={rows}
            energySlots={energySlots}
            missingSlots={missingSlots}
            exchangeRate={exchangeRate}
            isBinder={!isDeck}
          />
        </div>
      )}

      {viewMode === "build" && (
      <>
      <div className="mt-6 flex items-center gap-2">
        <label className="text-xs text-ink-400">Filtrar por tipo:</label>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-ink-900 border border-ink-700 rounded px-2 py-1.5 text-xs"
        >
          {CARD_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Cartas en el mazo/binder (las energías van aquí, cuentan como cartas del mazo) */}
      <div className="mt-6">
        <h2 className="font-display font-semibold text-lg">
          {isDeck ? "Cartas en el mazo" : "Cartas en el binder"}
        </h2>
        {visibleRows.length === 0 && (!isDeck || energySlots.length === 0) ? (
          <p className="text-ink-400 text-sm mt-3">Ninguna carta coincide todavía.</p>
        ) : isDeck ? (
          <div className="mt-4 flex flex-col gap-2">
            {deckGroups.map((g) =>
              g.rows.length === 1 ? (
                <AllocationRow
                  key={g.rows[0].alloc.id}
                  row={g.rows[0]}
                  exchangeRate={exchangeRate}
                  onAdjust={(d) => adjustAllocQty(g.rows[0], d)}
                  onMove={() =>
                    setMoveTarget({
                      kind: "allocation",
                      id: g.rows[0].alloc.id,
                      currentContainerId: container.id,
                      maxQuantity: g.rows[0].alloc.quantity,
                    })
                  }
                  onRemove={() => {
                    removeAllocation(g.rows[0].alloc.id);
                    load();
                  }}
                />
              ) : (
                <details key={g.key} className="bg-ink-800 border border-ink-700 rounded-card">
                  <summary className="cursor-pointer p-3 text-sm font-medium flex justify-between">
                    <span>
                      {g.cardName} · x{g.totalQty}
                    </span>
                    <span className="text-ink-400 text-xs">{g.rows.length} versiones — clic para ver</span>
                  </summary>
                  <div className="p-3 pt-0 flex flex-col gap-2">
                    {g.rows.map((row) => (
                      <AllocationRow
                        key={row.alloc.id}
                        row={row}
                        exchangeRate={exchangeRate}
                        onAdjust={(d) => adjustAllocQty(row, d)}
                        onMove={() =>
                          setMoveTarget({
                            kind: "allocation",
                            id: row.alloc.id,
                            currentContainerId: container.id,
                            maxQuantity: row.alloc.quantity,
                          })
                        }
                        onRemove={() => {
                          removeAllocation(row.alloc.id);
                          load();
                        }}
                      />
                    ))}
                  </div>
                </details>
              )
            )}
            {energySlots.map((slot) => (
              <WorkSlotRow
                key={slot.id}
                slot={slot}
                exchangeRate={exchangeRate}
                onAdjust={(d) => adjustWorkQty(slot, d)}
                onMove={() =>
                  setMoveTarget({
                    kind: "workslot",
                    id: slot.id,
                    currentContainerId: container.id,
                    maxQuantity: slot.quantity,
                  })
                }
                onRemove={() => {
                  removeWorkSlot(slot.id);
                  load();
                }}
                onReplace={() => setReplaceTarget(slot)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {visibleRows
              .slice()
              .sort((a, b) => a.entry.cardName.localeCompare(b.entry.cardName))
              .map((row) => (
                <AllocationRow
                  key={row.alloc.id}
                  row={row}
                  exchangeRate={exchangeRate}
                  onAdjust={(d) => adjustAllocQty(row, d)}
                  onMove={() =>
                    setMoveTarget({
                      kind: "allocation",
                      id: row.alloc.id,
                      currentContainerId: container.id,
                      maxQuantity: row.alloc.quantity,
                    })
                  }
                  onRemove={() => {
                    removeAllocation(row.alloc.id);
                    load();
                  }}
                />
              ))}
          </div>
        )}
      </div>

      {/* Cartas que faltan (Pokémon/Trainer que aún no tienes) */}
      {isDeck && missingSlots.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display font-semibold text-lg">Cartas que faltan</h2>
          <div className="mt-4 flex flex-col gap-2">
            {missingSlots.map((slot) => (
              <WorkSlotRow
                key={slot.id}
                slot={slot}
                exchangeRate={exchangeRate}
                onAdjust={(d) => adjustWorkQty(slot, d)}
                onMove={() =>
                  setMoveTarget({
                    kind: "workslot",
                    id: slot.id,
                    currentContainerId: container.id,
                    maxQuantity: slot.quantity,
                  })
                }
                onRemove={() => {
                  removeWorkSlot(slot.id);
                  load();
                }}
                onReplace={() => setReplaceTarget(slot)}
              />
            ))}
          </div>
        </div>
      )}
      </>
      )}

      {showAdd && (
        <AddCardDialog
          containerId={container.id}
          isDeck={isDeck}
          allowWork={isDeck && container.workMode}
          onClose={() => setShowAdd(false)}
          onAdded={load}
        />
      )}

      {showImagePicker && (
        <ContainerImagePicker
          candidateImages={candidateImages}
          onClose={() => setShowImagePicker(false)}
          onSelect={(image) => {
            updateContainer(container.id, { image });
            setShowImagePicker(false);
            load();
          }}
        />
      )}

      {showExportImport && (
        <ExportImportDialog
          container={container}
          rows={rows}
          workSlots={workSlots}
          onClose={() => setShowExportImport(false)}
          onImported={load}
        />
      )}

      {moveTarget && (
        <MoveDialog
          target={moveTarget}
          onClose={() => setMoveTarget(null)}
          onMoved={() => {
            setMoveTarget(null);
            load();
          }}
        />
      )}

      {replaceTarget && (
        <ReplaceWorkSlotDialog
          slot={replaceTarget}
          onClose={() => setReplaceTarget(null)}
          onReplaced={() => {
            setReplaceTarget(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function AllocationRow({
  row,
  exchangeRate,
  onAdjust,
  onMove,
  onRemove,
}: {
  row: Row;
  exchangeRate: number;
  onAdjust: (delta: number) => void;
  onMove: () => void;
  onRemove: () => void;
}) {
  const { entry, alloc } = row;
  const [showDetail, setShowDetail] = useState(false);
  const priceLine =
    entry.priceUsd != null
      ? `${formatGtq(usdToGtq(entry.priceUsd * alloc.quantity, exchangeRate))}`
      : null;

  return (
    <div className="flex items-center gap-3 bg-ink-800 border border-ink-700 rounded-lg p-2.5">
      <button
        onClick={() => setShowDetail(true)}
        className="relative w-11 aspect-[5/7] rounded overflow-hidden bg-ink-900 shrink-0"
        title="Ver detalle de la carta"
      >
        <CardImage src={entry.imageUrl} alt={entry.cardName} className="object-contain" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {entry.cardName}
          {entry.isHolo && <span className="text-holo-cyan text-[10px] ml-1">HOLO</span>}
        </p>
        <p className="text-ink-400 text-xs">
          {entry.setName} · #{entry.number}
        </p>
        {priceLine && <p className="text-gold text-xs font-mono">{priceLine}</p>}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onAdjust(-1)}
          className="w-6 h-6 rounded-full bg-ink-700 text-ink-100 text-sm"
        >
          −
        </button>
        <span className="font-mono text-sm w-4 text-center">{alloc.quantity}</span>
        <button
          onClick={() => onAdjust(1)}
          className="w-6 h-6 rounded-full bg-ink-700 text-ink-100 text-sm"
        >
          +
        </button>
      </div>
      <button onClick={onMove} className="text-xs text-holo-cyan hover:underline">
        Mover
      </button>
      <button onClick={onRemove} className="text-xs text-danger/80 hover:text-danger">
        Quitar
      </button>
      {showDetail && (
        <CardDetailModal
          cardId={entry.cardId}
          exchangeRate={exchangeRate}
          onClose={() => setShowDetail(false)}
        />
      )}
    </div>
  );
}

function WorkSlotRow({
  slot,
  exchangeRate,
  onAdjust,
  onMove,
  onRemove,
  onReplace,
}: {
  slot: WorkSlot;
  exchangeRate: number;
  onAdjust: (delta: number) => void;
  onMove: () => void;
  onRemove: () => void;
  onReplace: () => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const priceLine =
    slot.priceUsd != null && !slot.isGeneric
      ? formatGtq(usdToGtq(slot.priceUsd * slot.quantity, exchangeRate))
      : null;

  return (
    <div
      className={`flex items-center gap-3 bg-ink-800 border border-dashed rounded-lg p-2.5 ${
        slot.isGeneric ? "border-grass/40" : "border-danger/40"
      }`}
    >
      {slot.isGeneric ? (
        <div className="relative w-11 aspect-[5/7] rounded overflow-hidden bg-ink-900 shrink-0">
          <CardImage src={slot.imageUrl} alt={slot.cardName} className="object-contain" />
        </div>
      ) : (
        <button
          onClick={() => setShowDetail(true)}
          className="relative w-11 aspect-[5/7] rounded overflow-hidden bg-ink-900 shrink-0"
          title="Ver detalle de la carta"
        >
          <CardImage src={slot.imageUrl} alt={slot.cardName} className="object-contain" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{slot.cardName}</p>
        <p className="text-ink-400 text-xs">
          {slot.isGeneric ? "Energía genérica" : `${slot.setName} · #${slot.number}`}
        </p>
        {priceLine && <p className="text-danger text-xs font-mono">falta · {priceLine}</p>}
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onAdjust(-1)} className="w-6 h-6 rounded-full bg-ink-700 text-ink-100 text-sm">
          −
        </button>
        <span className="font-mono text-sm w-4 text-center">{slot.quantity}</span>
        <button onClick={() => onAdjust(1)} className="w-6 h-6 rounded-full bg-ink-700 text-ink-100 text-sm">
          +
        </button>
      </div>
      {!slot.isGeneric && (
        <a
          href={buildTcgPlayerSearchUrl(slot.cardName, slot.setName)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gold hover:underline"
          title="Buscar en TCGPlayer"
        >
          Comprar
        </a>
      )}
      {!slot.isGeneric && (
        <button onClick={onReplace} className="text-xs text-grass hover:underline">
          Ya la conseguí
        </button>
      )}
      <button onClick={onMove} className="text-xs text-holo-cyan hover:underline">
        Mover
      </button>
      <button onClick={onRemove} className="text-xs text-danger/80 hover:text-danger">
        Quitar
      </button>
      {showDetail && (
        <CardDetailModal
          cardId={slot.cardId}
          exchangeRate={exchangeRate}
          onClose={() => setShowDetail(false)}
        />
      )}
    </div>
  );
}
