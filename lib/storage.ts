// Todo se guarda en el navegador (localStorage). No hay servidor ni base de
// datos: por eso esta app puede alojarse como sitio estático (GitHub Pages).
//
// Contrapartida: la colección vive en ESTE navegador/dispositivo, no se
// sincroniza sola entre el teléfono y la computadora. Para eso está la
// función de exportar/importar (ver lib/exportImport.ts).

export type CardCategory = "Pokemon" | "Trainer" | "Energy";

export interface CollectionEntry {
  id: string;
  cardId: string; // id de TCGdex, ej. "swsh3-136"
  cardName: string;
  category: CardCategory;
  trainerType: string | null; // "Item" | "Supporter" | "Stadium" | "Tool"…
  energyType: string | null; // "Basic" | "Special"
  setId: string;
  setName: string;
  setAbbreviation: string | null; // código PTCGO/Live del set, ej. "TWM"
  number: string; // localId dentro del set
  rarity: string | null;
  regulationMark: string | null; // letra de rotación (ej. "G", "H"), solo Pokémon/Trainer/Energy con marca
  imageUrl: string; // URL ya resuelta (con calidad/extensión)
  tcgPlayerUrl: string | null;
  quantity: number;
  condition: string; // NM, LP, MP, HP, DMG
  language: string;
  isHolo: boolean; // marcado manualmente — solo se agrupa con otras holo
  priceUsd: number | null;
  priceUpdatedAt: string | null;
  notes: string | null;
  markedBulk: boolean; // forzado manualmente como "bulk", sin importar precio
  // Firma del efecto (solo Pokémon) usada para agrupar reimpresiones
  // jugablemente idénticas en la vista de mazos. Ver lib/reprints.ts.
  effectSignature: string | null;
  createdAt: string;
}

export interface AppSettings {
  exchangeRate: number; // quetzales por 1 USD
  bulkModeEnabled: boolean;
  bulkThresholdGtq: number; // por debajo de esto (precio unitario) se considera bulk
  // Rango de regulation mark que consideras "formato Standard" vigente, para
  // el validador de legalidad de mazos. Vacío = no se revisa este punto.
  standardMarkFrom: string;
  standardMarkTo: string;
}

// ---------------------------------------------------------------------------
// Colecciones (binders y mazos)
// ---------------------------------------------------------------------------

export type ContainerType = "deck" | "binder";

export interface ContainerImage {
  kind: "icon" | "card";
  icon?: string; // id de ícono preestablecido (galería)
  color?: string; // color de acento
  cardImageUrl?: string; // cuando kind === "card": imagen de una carta del propio contenedor
}

export interface Container {
  id: string;
  type: ContainerType;
  name: string;
  image: ContainerImage;
  workMode: boolean; // solo aplica a mazos
  createdAt: string;
}

// Copias reales de tu colección asignadas a un binder o mazo.
export interface Allocation {
  id: string;
  containerId: string;
  collectionEntryId: string;
  quantity: number;
}

// Solo para mazos: renglones de cartas que necesitas pero que no están (o no
// del todo) respaldadas por copias que ya posees — o energías básicas
// genéricas que no necesitan estar en tu colección para nada (isGeneric).
export interface WorkSlot {
  id: string;
  deckId: string;
  cardId: string; // id de TCGdex de la impresión de referencia, o "generic-energy-<tipo>"
  cardName: string;
  category: CardCategory;
  trainerType: string | null;
  energyType: string | null;
  setId: string;
  setName: string;
  setAbbreviation: string | null;
  number: string;
  regulationMark: string | null;
  imageUrl: string;
  quantity: number;
  priceUsd: number | null;
  isGeneric: boolean; // energía básica genérica: no cuenta como "falta comprar"
}

const COLLECTION_KEY = "pokedex-tcg:collection";
const SETTINGS_KEY = "pokedex-tcg:settings";
const CONTAINERS_KEY = "pokedex-tcg:containers";
const ALLOCATIONS_KEY = "pokedex-tcg:allocations";
const WORKSLOTS_KEY = "pokedex-tcg:workslots";

const DEFAULT_SETTINGS: AppSettings = {
  exchangeRate: 7.5,
  bulkModeEnabled: false,
  bulkThresholdGtq: 5,
  standardMarkFrom: "",
  standardMarkTo: "",
};

function isBrowser() {
  return typeof window !== "undefined";
}

function generateId(): string {
  if (isBrowser() && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// Colección principal
// ---------------------------------------------------------------------------

export function getCollection(): CollectionEntry[] {
  return readJson<CollectionEntry[]>(COLLECTION_KEY, []);
}

function saveCollection(entries: CollectionEntry[]) {
  writeJson(COLLECTION_KEY, entries);
}

export function getCollectionEntry(id: string): CollectionEntry | undefined {
  return getCollection().find((e) => e.id === id);
}

export function addToCollection(
  data: Omit<CollectionEntry, "id" | "createdAt">
): CollectionEntry {
  const entry: CollectionEntry = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  saveCollection([entry, ...getCollection()]);
  return entry;
}

// Agrega una carta a la colección, pero si ya existe una entrada IDÉNTICA
// (misma carta, condición, idioma y estado holo/normal) simplemente le suma
// la cantidad en vez de crear un renglón aparte. Las holo nunca se agrupan
// con las normales, aunque sean la misma impresión.
export function addOrMergeToCollection(
  data: Omit<CollectionEntry, "id" | "createdAt">
): { entry: CollectionEntry; merged: boolean } {
  const existing = getCollection().find(
    (e) =>
      e.cardId === data.cardId &&
      e.condition === data.condition &&
      e.language === data.language &&
      e.isHolo === data.isHolo
  );

  if (existing) {
    const updated = { ...existing, quantity: existing.quantity + data.quantity };
    saveCollection(getCollection().map((e) => (e.id === existing.id ? updated : e)));
    return { entry: updated, merged: true };
  }

  return { entry: addToCollection(data), merged: false };
}

export function updateCollectionEntry(
  id: string,
  patch: Partial<Omit<CollectionEntry, "id" | "createdAt">>
) {
  saveCollection(
    getCollection().map((entry) =>
      entry.id === id ? { ...entry, ...patch } : entry
    )
  );
}

export function removeCollectionEntry(id: string) {
  saveCollection(getCollection().filter((entry) => entry.id !== id));
  // limpia también cualquier asignación huérfana en binders/mazos
  saveAllocations(getAllocations().filter((a) => a.collectionEntryId !== id));
}

// Precio unitario (en GTQ) de una entrada, usado para decidir si es "bulk".
export function entryUnitPriceGtq(entry: CollectionEntry, settings: AppSettings): number {
  return (entry.priceUsd ?? 0) * settings.exchangeRate;
}

// Una carta es "bulk" si el usuario la marcó manualmente, o si el modo bulk
// está activo y su precio unitario cae debajo del umbral configurado.
export function isEntryBulk(entry: CollectionEntry, settings: AppSettings): boolean {
  if (entry.markedBulk) return true;
  if (!settings.bulkModeEnabled) return false;
  return entryUnitPriceGtq(entry, settings) < settings.bulkThresholdGtq;
}

// ---------------------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------------------

export function getSettings(): AppSettings {
  const raw = readJson<Partial<AppSettings> | null>(SETTINGS_KEY, null);
  return raw ? { ...DEFAULT_SETTINGS, ...raw } : DEFAULT_SETTINGS;
}

export function updateSettings(patch: Partial<AppSettings>) {
  writeJson(SETTINGS_KEY, { ...getSettings(), ...patch });
}

// ---------------------------------------------------------------------------
// Contenedores (binders y mazos)
// ---------------------------------------------------------------------------

export function getContainers(): Container[] {
  return readJson<Container[]>(CONTAINERS_KEY, []);
}

function saveContainers(containers: Container[]) {
  writeJson(CONTAINERS_KEY, containers);
}

export function getContainer(id: string): Container | undefined {
  return getContainers().find((c) => c.id === id);
}

export function addContainer(
  data: Omit<Container, "id" | "createdAt">
): Container {
  const container: Container = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  saveContainers([container, ...getContainers()]);
  return container;
}

export function updateContainer(id: string, patch: Partial<Container>) {
  saveContainers(
    getContainers().map((c) => (c.id === id ? { ...c, ...patch } : c))
  );
}

export function removeContainer(id: string) {
  saveContainers(getContainers().filter((c) => c.id !== id));
  saveAllocations(getAllocations().filter((a) => a.containerId !== id));
  saveWorkSlots(getWorkSlots().filter((w) => w.deckId !== id));
}

// ---------------------------------------------------------------------------
// Asignaciones (qué copias de tu colección están en qué binder/mazo)
// ---------------------------------------------------------------------------

export function getAllocations(): Allocation[] {
  return readJson<Allocation[]>(ALLOCATIONS_KEY, []);
}

function saveAllocations(allocations: Allocation[]) {
  writeJson(ALLOCATIONS_KEY, allocations);
}

export function getAllocationsForContainer(containerId: string): Allocation[] {
  return getAllocations().filter((a) => a.containerId === containerId);
}

export function getAllocationsForEntry(collectionEntryId: string): Allocation[] {
  return getAllocations().filter((a) => a.collectionEntryId === collectionEntryId);
}

export function getAllocatedQuantity(collectionEntryId: string): number {
  return getAllocationsForEntry(collectionEntryId).reduce(
    (sum, a) => sum + a.quantity,
    0
  );
}

// Cuántas copias de una entrada siguen SIN asignar a ningún binder/mazo.
export function getAvailableQuantity(collectionEntryId: string): number {
  const entry = getCollectionEntry(collectionEntryId);
  if (!entry) return 0;
  return Math.max(0, entry.quantity - getAllocatedQuantity(collectionEntryId));
}

// En qué binders/mazos está asignada una entrada de la colección, y cuánto
// en cada uno — para la función "¿dónde tengo esta carta?".
export function getContainersForEntry(
  collectionEntryId: string
): { container: Container; quantity: number }[] {
  return getAllocationsForEntry(collectionEntryId)
    .map((a) => {
      const container = getContainer(a.containerId);
      return container ? { container, quantity: a.quantity } : null;
    })
    .filter((x): x is { container: Container; quantity: number } => x !== null);
}

// Agrega (o suma, si ya existía) una asignación de N copias de una entrada
// a un contenedor. Valida contra la cantidad disponible.
export function allocateToContainer(
  containerId: string,
  collectionEntryId: string,
  quantity: number
): { ok: boolean; reason?: string } {
  if (quantity <= 0) return { ok: false, reason: "Cantidad inválida." };
  const available = getAvailableQuantity(collectionEntryId);
  if (quantity > available) {
    return {
      ok: false,
      reason: `Solo tienes ${available} copia(s) sin asignar de esta carta.`,
    };
  }

  const allocations = getAllocations();
  const existing = allocations.find(
    (a) => a.containerId === containerId && a.collectionEntryId === collectionEntryId
  );

  if (existing) {
    existing.quantity += quantity;
    saveAllocations([...allocations]);
  } else {
    allocations.push({
      id: generateId(),
      containerId,
      collectionEntryId,
      quantity,
    });
    saveAllocations(allocations);
  }
  return { ok: true };
}

export function setAllocationQuantity(allocationId: string, quantity: number) {
  const allocations = getAllocations();
  if (quantity <= 0) {
    saveAllocations(allocations.filter((a) => a.id !== allocationId));
    return;
  }
  saveAllocations(
    allocations.map((a) => (a.id === allocationId ? { ...a, quantity } : a))
  );
}

export function removeAllocation(allocationId: string) {
  saveAllocations(getAllocations().filter((a) => a.id !== allocationId));
}

// Mueve N copias de una entrada de un contenedor a otro (binder<->binder,
// binder<->mazo, mazo<->mazo).
export function moveAllocation(
  allocationId: string,
  toContainerId: string,
  quantity: number
): { ok: boolean; reason?: string } {
  const allocations = getAllocations();
  const source = allocations.find((a) => a.id === allocationId);
  if (!source) return { ok: false, reason: "No se encontró la asignación." };
  if (quantity <= 0 || quantity > source.quantity) {
    return { ok: false, reason: "Cantidad inválida." };
  }

  const remaining = source.quantity - quantity;
  const next = remaining > 0
    ? allocations.map((a) => (a.id === allocationId ? { ...a, quantity: remaining } : a))
    : allocations.filter((a) => a.id !== allocationId);

  const dest = next.find(
    (a) => a.containerId === toContainerId && a.collectionEntryId === source.collectionEntryId
  );
  if (dest) {
    dest.quantity += quantity;
  } else {
    next.push({
      id: generateId(),
      containerId: toContainerId,
      collectionEntryId: source.collectionEntryId,
      quantity,
    });
  }

  saveAllocations(next);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Renglones de "trabajo" (mazos): cartas faltantes o energías genéricas
// ---------------------------------------------------------------------------

export function getWorkSlots(): WorkSlot[] {
  return readJson<WorkSlot[]>(WORKSLOTS_KEY, []);
}

function saveWorkSlots(slots: WorkSlot[]) {
  writeJson(WORKSLOTS_KEY, slots);
}

export function getWorkSlotsForDeck(deckId: string): WorkSlot[] {
  return getWorkSlots().filter((w) => w.deckId === deckId);
}

export function addWorkSlot(data: Omit<WorkSlot, "id">): WorkSlot {
  const slots = getWorkSlots();
  const existing = slots.find(
    (w) => w.deckId === data.deckId && w.cardId === data.cardId
  );
  if (existing) {
    existing.quantity += data.quantity;
    saveWorkSlots([...slots]);
    return existing;
  }
  const slot: WorkSlot = { ...data, id: generateId() };
  saveWorkSlots([slot, ...slots]);
  return slot;
}

export function updateWorkSlot(id: string, patch: Partial<WorkSlot>) {
  const slots = getWorkSlots();
  if (patch.quantity != null && patch.quantity <= 0) {
    saveWorkSlots(slots.filter((w) => w.id !== id));
    return;
  }
  saveWorkSlots(slots.map((w) => (w.id === id ? { ...w, ...patch } : w)));
}

export function removeWorkSlot(id: string) {
  saveWorkSlots(getWorkSlots().filter((w) => w.id !== id));
}

export function moveWorkSlot(id: string, toDeckId: string) {
  const slots = getWorkSlots();
  const slot = slots.find((w) => w.id === id);
  if (!slot) return;
  const rest = slots.filter((w) => w.id !== id);
  const dest = rest.find((w) => w.deckId === toDeckId && w.cardId === slot.cardId);
  if (dest) {
    dest.quantity += slot.quantity;
    saveWorkSlots(rest);
  } else {
    saveWorkSlots([{ ...slot, deckId: toDeckId }, ...rest]);
  }
}

// "Ya la conseguí": sustituye N copias de un renglón faltante por copias
// reales que ya tienes disponibles en la colección (crea/suma la asignación
// y reduce o borra el renglón de trabajo).
export function replaceWorkSlotWithOwned(
  workSlotId: string,
  collectionEntryId: string,
  quantity: number
): { ok: boolean; reason?: string } {
  const slot = getWorkSlots().find((w) => w.id === workSlotId);
  if (!slot) return { ok: false, reason: "No se encontró el renglón." };
  if (quantity <= 0 || quantity > slot.quantity) {
    return { ok: false, reason: "Cantidad inválida." };
  }
  const result = allocateToContainer(slot.deckId, collectionEntryId, quantity);
  if (!result.ok) return result;
  updateWorkSlot(workSlotId, { quantity: slot.quantity - quantity });
  return { ok: true };
}

// Botón "Actualizar": revisa todos los renglones de un mazo (faltantes y
// energías no genéricas) contra la colección actual, y asigna automáticamente
// las copias que ya estén disponibles — como correr "Ya la conseguí" en
// todos a la vez. Devuelve cuántas copias se pudieron cubrir.
export function refreshWorkSlots(deckId: string): { resolved: number } {
  let resolved = 0;
  for (const slot of getWorkSlotsForDeck(deckId)) {
    if (slot.isGeneric || slot.quantity <= 0) continue;

    const owned =
      slot.category === "Energy"
        ? getCollection().filter((e) => e.cardName === slot.cardName)
        : getCollection().filter((e) => e.cardId === slot.cardId);

    let remaining = slot.quantity;
    for (const entry of owned) {
      if (remaining <= 0) break;
      const available = getAvailableQuantity(entry.id);
      const take = Math.min(available, remaining);
      if (take > 0) {
        allocateToContainer(deckId, entry.id, take);
        remaining -= take;
        resolved += take;
      }
    }
    if (remaining < slot.quantity) {
      updateWorkSlot(slot.id, { quantity: remaining });
    }
  }
  return { resolved };
}

// Valor total (USD) de las cartas que le faltan a un mazo (no cuenta las
// energías genéricas: esas no representan una compra pendiente).
export function getDeckMissingValueUsd(deckId: string): number {
  return getWorkSlotsForDeck(deckId)
    .filter((w) => !w.isGeneric)
    .reduce((sum, w) => sum + (w.priceUsd ?? 0) * w.quantity, 0);
}
