// Junta en un solo lugar todo lo que hace falta comprar: las cartas
// faltantes de todos los mazos (renglones de trabajo, sin contar energías
// genéricas) y las de la lista de deseos — agrupadas por carta, con el
// origen de cada una.

import { getContainers, getWorkSlotsForDeck, getWishlist } from "./storage";

export interface ShoppingSource {
  type: "deck" | "wishlist";
  id: string; // id del mazo, o del renglón de deseos
  label: string; // nombre del mazo, o "Lista de deseos"
  quantity: number;
}

export interface ShoppingLine {
  cardId: string;
  cardName: string;
  setName: string;
  number: string;
  imageUrl: string;
  priceUsd: number | null;
  totalQuantity: number;
  sources: ShoppingSource[];
}

export function buildShoppingList(): ShoppingLine[] {
  const byCard = new Map<string, ShoppingLine>();

  function add(
    cardId: string,
    cardName: string,
    setName: string,
    number: string,
    imageUrl: string,
    priceUsd: number | null,
    quantity: number,
    source: ShoppingSource
  ) {
    const existing = byCard.get(cardId);
    if (existing) {
      existing.totalQuantity += quantity;
      existing.sources.push(source);
    } else {
      byCard.set(cardId, {
        cardId,
        cardName,
        setName,
        number,
        imageUrl,
        priceUsd,
        totalQuantity: quantity,
        sources: [source],
      });
    }
  }

  for (const deck of getContainers().filter((c) => c.type === "deck")) {
    for (const slot of getWorkSlotsForDeck(deck.id)) {
      if (slot.isGeneric) continue;
      add(slot.cardId, slot.cardName, slot.setName, slot.number, slot.imageUrl, slot.priceUsd, slot.quantity, {
        type: "deck",
        id: deck.id,
        label: deck.name,
        quantity: slot.quantity,
      });
    }
  }

  for (const item of getWishlist()) {
    add(item.cardId, item.cardName, item.setName, item.number, item.imageUrl, item.priceUsd, 1, {
      type: "wishlist",
      id: item.id,
      label: "Lista de deseos",
      quantity: 1,
    });
  }

  return Array.from(byCard.values()).sort(
    (a, b) => (b.priceUsd ?? 0) * b.totalQuantity - (a.priceUsd ?? 0) * a.totalQuantity
  );
}
