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
} from "@/lib/storage";
import type { Container, ContainerType } from "@/lib/storage";
import ContainerIcon from "@/components/ContainerIcon";
import { formatGtq, usdToGtq, DEFAULT_EXCHANGE_RATE } from "@/lib/currency";

export default function ColeccionesPage() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [exchangeRate, setExchangeRate] = useState(DEFAULT_EXCHANGE_RATE);
  const [creating, setCreating] = useState<ContainerType | null>(null);
  const [newName, setNewName] = useState("");
  const [newWorkMode, setNewWorkMode] = useState(false);

  const load = useCallback(() => {
    setContainers(getContainers());
    setExchangeRate(getSettings().exchangeRate);
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
    addContainer({
      type: creating,
      name,
      image: { kind: "icon", icon: creating === "deck" ? "deck" : "binder" },
      workMode: creating === "deck" ? newWorkMode : false,
      utilityForDecks: false,
    });
    setCreating(null);
    load();
  }

  const decks = containers.filter((c) => c.type === "deck");
  const binders = containers.filter((c) => c.type === "binder");

  return (
    <div>
      <h1 className="font-display font-bold text-2xl">Colecciones</h1>
      <p className="text-ink-400 text-sm mt-1">
        Organiza tus cartas en mazos (para jugar) o binders (portafolio, para
        guardar y vender). Cada carta que asignes aquí sale de tu inventario
        "sin asignar" en Mi colección.
      </p>

      <Section
        title="Mazos"
        emptyText="Todavía no tienes mazos."
        onCreate={() => openCreate("deck")}
        createLabel="+ Nuevo mazo"
      >
        {decks.map((c) => (
          <ContainerTile key={c.id} container={c} exchangeRate={exchangeRate} />
        ))}
      </Section>

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
        .filter((w) => w.category === "Energy")
        .reduce((sum, w) => sum + w.quantity, 0)
    : 0;
  const totalUnits = allocations.reduce((sum, a) => sum + a.quantity, 0) + energyUnits;
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
      <p className="text-ink-400 text-xs">{totalUnits} cartas asignadas</p>
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
