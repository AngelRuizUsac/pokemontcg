"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getContainer,
  getAllocationsForContainer,
  getWorkSlotsForDeck,
  getCollectionEntry,
} from "@/lib/storage";
import type { Container, Allocation, WorkSlot, CollectionEntry } from "@/lib/storage";
import CardImage from "@/components/CardImage";

interface Row {
  entry: CollectionEntry;
  alloc: Allocation;
}

interface PrintCard {
  imageUrl: string;
  name: string;
  quantity: number;
  isProxy: boolean; // carta que aún no tienes — se marca como referencia/proxy
}

export default function ImprimirPage() {
  const [container, setContainer] = useState<Container | null | undefined>(undefined);
  const [cards, setCards] = useState<PrintCard[]>([]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      setContainer(null);
      return;
    }
    const c = getContainer(id) ?? null;
    setContainer(c);
    if (!c) return;

    const rows: Row[] = getAllocationsForContainer(id)
      .map((alloc) => {
        const entry = getCollectionEntry(alloc.collectionEntryId);
        return entry ? { entry, alloc } : null;
      })
      .filter((r): r is Row => r !== null);
    const workSlots: WorkSlot[] = getWorkSlotsForDeck(id).filter((w) => !w.isGeneric);

    const owned: PrintCard[] = rows
      .slice()
      .sort((a, b) => a.entry.cardName.localeCompare(b.entry.cardName))
      .map((r) => ({
        imageUrl: r.entry.imageUrl,
        name: r.entry.cardName,
        quantity: r.alloc.quantity,
        isProxy: false,
      }));
    const missing: PrintCard[] = workSlots
      .slice()
      .sort((a, b) => a.cardName.localeCompare(b.cardName))
      .map((w) => ({
        imageUrl: w.imageUrl,
        name: w.cardName,
        quantity: w.quantity,
        isProxy: true,
      }));

    setCards([...owned, ...missing]);
  }, []);

  if (container === undefined) return null;

  if (!container) {
    return <p className="text-ink-400 text-sm">No se encontró esta colección.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div>
          <Link href={`/coleccion/?id=${container.id}`} className="text-ink-400 text-sm hover:text-ink-50">
            ← {container.name}
          </Link>
          <h1 className="font-display font-bold text-xl mt-1">Hoja de práctica para imprimir</h1>
          <p className="text-ink-400 text-sm mt-1 max-w-md">
            Para practicar en casa — no reemplaza tus cartas reales ni sirve para juego
            organizado/torneos. Las cartas marcadas "proxy" son las que todavía te faltan.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-5 py-2.5 rounded-full bg-gold text-ink-900 text-sm font-medium hover:bg-gold-light"
        >
          Imprimir
        </button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 print:grid-cols-4 gap-4 mt-6 print:mt-0">
        {cards.map((c, i) => (
          <div key={i} className="relative break-inside-avoid">
            <div className="relative aspect-[5/7] w-full rounded overflow-hidden bg-ink-900">
              <CardImage src={c.imageUrl} alt={c.name} sizes="200px" className="object-contain" />
            </div>
            <p className="text-center text-[11px] mt-1 print:text-black">
              {c.name} x{c.quantity}
              {c.isProxy && <span className="text-danger print:text-black"> (proxy)</span>}
            </p>
          </div>
        ))}
      </div>

      {cards.length === 0 && (
        <p className="text-ink-400 text-sm mt-8">Este mazo todavía no tiene cartas.</p>
      )}
    </div>
  );
}
