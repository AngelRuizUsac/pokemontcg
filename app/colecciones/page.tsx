"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  getContainers,
  addContainer,
  getAllocationsForContainer,
  getWorkSlotsForDeck,
  getDeckMissingValueUsd,
  getSettings,
  getUsedLinksRequestedBy,
  reorderDeckPriority,
  runDeckReajuste,
  getMoveLog,
  clearMoveLog,
} from "@/lib/storage";
import type { Container, ContainerType, MoveLogEntry } from "@/lib/storage";
import ContainerIcon from "@/components/ContainerIcon";
import { formatGtq, usdToGtq, DEFAULT_EXCHANGE_RATE } from "@/lib/currency";

export default function ColeccionesPage() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [exchangeRate, setExchangeRate] = useState(DEFAULT_EXCHANGE_RATE);
  const [creating, setCreating] = useState<ContainerType | null>(null);
  const [newName, setNewName] = useState("");
  const [newWorkMode, setNewWorkMode] = useState(false);
  const [moveLog, setMoveLog] = useState<MoveLogEntry[]>([]);
  const [reajusteMessage, setReajusteMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setContainers(getContainers());
    setExchangeRate(getSettings().exchangeRate);
    setMoveLog(getMoveLog());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate(type: ContainerType) {
    setCreating(type);
    setNewName("");
    setNewWorkMode(false);
  }

  function confirmCreate() {
    if (!creating) return;
    const name =
      newName.trim() || (creating === "deck" ? "Mazo sin nombre" : "Binder sin nombre");
    const existingDeckPriorities = containers
      .filter((c) => c.type === "deck")
      .map((c) => c.priority);
    const nextPriority = existingDeckPriorities.length > 0 ? Math.max(...existingDeckPriorities) + 1 : 0;
    addContainer({
      type: creating,
      name,
      image: { kind: "icon", icon: creating === "deck" ? "deck" : "binder" },
      workMode: creating === "deck" ? newWorkMode : false,
      utilityForDecks: false,
      priority: creating === "deck" ? nextPriority : 0,
    });
    setCreating(null);
    load();
  }

  const decks = containers
    .filter((c) => c.type === "deck")
    .sort((a, b) => a.priority - b.priority);
  const binders = containers.filter((c) => c.type === "binder");

  function changePriority(deckId: string, direction: "up" | "down") {
    reorderDeckPriority(deckId, direction);
    load();
  }

  function reajustar() {
    const result = runDeckReajuste();
    setReajusteMessage(
      result.movedCount > 0 || result.linkedCount > 0
        ? `Se movieron ${result.movedCount} carta(s) y ${result.linkedCount} quedaron identificadas como usadas en otro mazo/binder.`
        : "Los mazos ya están ajustados con las cartas disponibles."
    );
    load();
  }

  return (
    <div>
      <h1 className="font-display font-bold text-2xl">Colecciones</h1>
      <p className="text-ink-400 text-sm mt-1">
        Organiza tus cartas en mazos (para jugar) o binders (portafolio, para
        guardar y vender). Cada carta que asignes aquí sale de tu inventario
        "sin asignar" en Mi colección.
      </p>

      <Section
        title="Mazos por relevancia"
        emptyText="Todavía no tienes mazos."
        onCreate={() => openCreate("deck")}
        createLabel="+ Nuevo mazo"
      >
        {decks.map((c, index) => (
          <div key={c.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-900/60 px-2 py-1">
              <span className="text-[10px] uppercase tracking-wide text-ink-400">
                {index === 0 ? "Principal" : `Prioridad ${index + 1}`}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label={`Subir relevancia de ${c.name}`}
                  disabled={index === 0}
                  onClick={() => changePriority(c.id, "up")}
                  className="px-2 py-0.5 text-xs rounded border border-ink-700 disabled:opacity-30 hover:border-gold/50"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Bajar relevancia de ${c.name}`}
                  disabled={index === decks.length - 1}
                  onClick={() => changePriority(c.id, "down")}
                  className="px-2 py-0.5 text-xs rounded border border-ink-700 disabled:opacity-30 hover:border-gold/50"
                >
                  ↓
                </button>
              </div>
            </div>
            <ContainerTile container={c} exchangeRate={exchangeRate} />
          </div>
        ))}
      </Section>

      {decks.length > 0 && (
        <div className="mt-4 rounded-card border border-gold/30 bg-gold/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-ink-300 max-w-xl">
              Reajustar completa primero el mazo principal y continúa de arriba hacia abajo,
              usando cartas de mazos menos relevantes cuando sea necesario.
            </p>
            <button
              type="button"
              onClick={reajustar}
              className="shrink-0 rounded-full bg-gold px-4 py-2 text-sm font-medium text-ink-900 hover:bg-gold-light"
            >
              Reajustar mazos
            </button>
          </div>
          {reajusteMessage && <p className="mt-3 text-xs text-holo-cyan">{reajusteMessage}</p>}
        </div>
      )}

      <Section
        title="Binders"
        emptyText="Todavía no tienes binders."
        onCreate={() => openCreate("binder")}
        createLabel="+ Nuevo binder"
      >
        {binders.map((c) => (
          <ContainerTile key={c.id} container={c} exchangeRate={exchangeRate} />
        ))}
      </Section>

      <div className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-lg">Registro de movimientos</h2>
            <p className="text-ink-400 text-xs mt-1">Carta, cantidad, origen y destino de cada movimiento.</p>
          </div>
          {moveLog.length > 0 && (
            <button
              type="button"
              onClick={() => {
                clearMoveLog();
                load();
              }}
              className="text-xs text-ink-400 hover:text-danger"
            >
              Limpiar registro
            </button>
          )}
        </div>
        {moveLog.length === 0 ? (
          <p className="mt-3 text-sm text-ink-400">Todavía no hay movimientos registrados.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-card border border-ink-700 bg-ink-800">
            {moveLog.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-1 border-b border-ink-700 p-3 last:border-b-0 sm:flex-row sm:items-center">
                <p className="text-sm flex-1">
                  <span className="font-medium">{entry.quantity}× {entry.cardName}</span>{" "}
                  <span className="text-ink-400">de {entry.fromContainerName} a {entry.toContainerName}</span>
                </p>
                <div className="flex items-center gap-2 text-[10px] text-ink-400">
                  <span className="rounded bg-ink-900 px-1.5 py-0.5 uppercase">{entry.reason}</span>
                  <time dateTime={entry.movedAt}>{new Date(entry.movedAt).toLocaleString()}</time>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {creating && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setCreating(null)}
        >
          <div
            className="bg-ink-800 border border-ink-700 rounded-card max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display font-semibold">
              Nuevo {creating === "deck" ? "mazo" : "binder"}
            </p>
            <label className="text-xs text-ink-400 flex flex-col gap-1 mt-4">
              Nombre
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={creating === "deck" ? "Mi mazo de Charizard" : "Cartas para vender"}
                className="bg-ink-900 border border-ink-700 rounded px-2.5 py-1.5 text-ink-50"
              />
            </label>

            {creating === "deck" && (
              <label className="flex items-center gap-2 mt-4 text-sm text-ink-100">
                <input
                  type="checkbox"
                  checked={newWorkMode}
                  onChange={(e) => setNewWorkMode(e.target.checked)}
                  className="accent-gold"
                />
                Modo trabajo (planear cartas que aún no tengo)
              </label>
            )}

            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={() => setCreating(null)}
                className="text-sm px-4 py-2 rounded-full text-ink-400 hover:text-ink-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmCreate}
                className="text-sm px-4 py-2 rounded-full bg-gold text-ink-900 font-medium hover:bg-gold-light"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  emptyText,
  onCreate,
  createLabel,
  children,
}: {
  title: string;
  emptyText: string;
  onCreate: () => void;
  createLabel: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-lg">{title}</h2>
        <button
          onClick={onCreate}
          className="text-xs px-3 py-1.5 rounded-full bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20"
        >
          {createLabel}
        </button>
      </div>
      {!hasChildren ? (
        <p className="text-ink-400 text-sm mt-3">{emptyText}</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {children}
        </div>
      )}
    </div>
  );
}

function ContainerTile({
  container,
  exchangeRate,
}: {
  container: Container;
  exchangeRate: number;
}) {
  const allocations = getAllocationsForContainer(container.id);
  const isDeck = container.type === "deck";
  // Las energías (genéricas o no) cuentan como cartas del mazo, igual que en
  // el detalle del mazo — antes solo se sumaban las asignaciones reales.
  const energyUnits = isDeck
    ? getWorkSlotsForDeck(container.id)
        .filter((w) => w.isGeneric)
        .reduce((sum, w) => sum + w.quantity, 0)
    : 0;
  const totalUnits = allocations.reduce((sum, a) => sum + a.quantity, 0) + energyUnits;
  const usedElsewhereUnits = isDeck
    ? getUsedLinksRequestedBy(container.id).reduce((sum, link) => sum + link.quantity, 0)
    : 0;
  const missingUsd = isDeck ? getDeckMissingValueUsd(container.id) : 0;

  return (
    <Link
      href={`/coleccion/?id=${container.id}`}
      className="bg-ink-800 border border-ink-700 rounded-card p-4 flex flex-col gap-2 hover:border-gold/40 transition-colors"
    >
      <ContainerIcon image={container.image} size={48} />
      <p className="font-display font-semibold text-sm leading-tight mt-1">
        {container.name}
      </p>
      <p className="text-ink-400 text-xs">
        {totalUnits + usedElsewhereUnits} {isDeck ? "cartas del mazo" : "cartas asignadas"}
      </p>
      {container.type === "deck" && container.workMode && (
        <span className="text-[10px] text-holo-cyan w-fit px-1.5 py-0.5 rounded bg-holo-cyan/10 border border-holo-cyan/30">
          modo trabajo
        </span>
      )}
      {container.type === "binder" && container.utilityForDecks && (
        <span className="text-[10px] text-grass w-fit px-1.5 py-0.5 rounded bg-grass/10 border border-grass/30">
          disponible para mazos
        </span>
      )}
      {missingUsd > 0 && (
        <p className="text-danger text-xs font-mono">
          faltan {formatGtq(usdToGtq(missingUsd, exchangeRate))}
        </p>
      )}
    </Link>
  );
}
