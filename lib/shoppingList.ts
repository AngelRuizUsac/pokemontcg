// Junta en un solo lugar todo lo que hace falta comprar: las cartas
// faltantes de todos los mazos (renglones de trabajo, sin contar energías
// genéricas) y las de la lista de deseos — agrupadas por carta, con el
// origen de cada una.

import { getContainers, getWorkSlotsForDeck, getWishlist, getUsedLinks, getCollectionEntry } from "./storage";
import { reprintGroupKey } from "./reprints";

export interface ShoppingSource {
  type: "deck" | "wishlist";
  id: string; // id del mazo, o del renglón de deseos
  label: string; // nombre del mazo, o "Lista de deseos"
  quantity: number;
}

export interface ShoppingLine {
  key: string;
  availability: "missing" | "owned-elsewhere";
  cardId: string;
  cardName: string;
  setName: string;
  number: string;
  imageUrl: string;
  priceUsd: number | null;
  totalQuantity: number;
  sources: ShoppingSource[];
  moves: { linkId: string; fromLabel: string; toLabel: string; quantity: number }[];
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
    source: ShoppingSource,
    availability: ShoppingLine["availability"] = "missing",
    move?: ShoppingLine["moves"][number],
    groupKey: string = cardId
  ) {
    const key = `${availability}:${groupKey}`;
    const existing = byCard.get(key);
    if (existing) {
      const existingSource = existing.sources.find(
        (item) => item.type === source.type && item.id === source.id
      );
      if (existingSource) existingSource.quantity += source.quantity;
      else existing.sources.push(source);
      if (move) existing.moves.push(move);
      if (availability === "missing") {
        // Un mismo juego de copias puede rotarse entre mazos. Se compra la
        // demanda mayor de un solo mazo, no la suma de todos los mazos.
        const deckMaximum = Math.max(
          0,
          ...existing.sources
            .filter((item) => item.type === "deck")
            .map((item) => item.quantity)
        );
        const wishlistTotal = existing.sources
          .filter((item) => item.type === "wishlist")
          .reduce((sum, item) => sum + item.quantity, 0);
        existing.totalQuantity = deckMaximum + wishlistTotal;
      } else {
        existing.totalQuantity += quantity;
      }
    } else {
      byCard.set(key, {
        key,
        availability,
        cardId,
        cardName,
        setName,
        number,
        imageUrl,
        priceUsd,
        totalQuantity: quantity,
        sources: [source],
        moves: move ? [move] : [],
      });
    }
  }

  for (const deck of getContainers().filter((c) => c.type === "deck")) {
    for (const slot of getWorkSlotsForDeck(deck.id)) {
      if (slot.isGeneric) continue;
      const groupKey = reprintGroupKey(
        slot.cardName,
        slot.category,
        slot.effectSignature,
        slot.cardId
      );
      add(slot.cardId, slot.cardName, slot.setName, slot.number, slot.imageUrl, slot.priceUsd, slot.quantity, {
        type: "deck",
        id: deck.id,
        label: deck.name,
        quantity: slot.quantity,
      }, "missing", undefined, groupKey);
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

  const containers = new Map(getContainers().map((container) => [container.id, container]));
  for (const link of getUsedLinks()) {
    const requesting = containers.get(link.requestingContainerId);
    const holding = containers.get(link.holdingContainerId);
    const entry = getCollectionEntry(link.collectionEntryId);
    if (!requesting || requesting.type !== "deck" || !holding || !entry) continue;
    add(
      entry.cardId,
      entry.cardName,
      entry.setName,
      entry.number,
      entry.imageUrl,
      entry.priceUsd,
      link.quantity,
      { type: "deck", id: requesting.id, label: requesting.name, quantity: link.quantity },
      "owned-elsewhere",
      { linkId: link.id, fromLabel: holding.name, toLabel: requesting.name, quantity: link.quantity }
    );
  }

  return Array.from(byCard.values()).sort(
    (a, b) => (b.priceUsd ?? 0) * b.totalQuantity - (a.priceUsd ?? 0) * a.totalQuantity
  );
}
