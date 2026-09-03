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
  askingPriceUsd: number | null; // precio propio de venta (para binders/portafolio) — distinto del precio de mercado
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
  // Qué tanto vale una carta según su condición, como fracción del precio de
  // mercado (ej. 0.5 = 50%). Se usa para que el valor total refleje mejor tu
  // inventario real, no solo el precio de una copia perfecta.
  conditionMultipliers: Record<string, number>;
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
  // Solo aplica a binders: si está activo, las cartas asignadas a este
  // binder siguen contando como "disponibles" y pueden usarse automáticamente
  // en un mazo (al agregarlas, al usar "Actualizar", etc.) — la copia se
  // mueve del binder al mazo en ese momento, no se duplica.
  utilityForDecks: boolean;
  // Solo aplica a mazos: prioridad para "Reajustar" — número más bajo =
  // más arriba en la lista = más prioridad para tener sus cartas completas.
  priority: number;
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
  effectSignature: string | null;
}

const COLLECTION_KEY = "pokedex-tcg:collection";
const SETTINGS_KEY = "pokedex-tcg:settings";
const CONTAINERS_KEY = "pokedex-tcg:containers";
const ALLOCATIONS_KEY = "pokedex-tcg:allocations";
const WORKSLOTS_KEY = "pokedex-tcg:workslots";

const DEFAULT_CONDITION_MULTIPLIERS: Record<string, number> = {
  NM: 1,
  LP: 0.85,
  MP: 0.7,
  HP: 0.5,
  DMG: 0.3,
};

const DEFAULT_SETTINGS: AppSettings = {
  exchangeRate: 7.5,
  bulkModeEnabled: false,
  bulkThresholdGtq: 5,
  standardMarkFrom: "",
  standardMarkTo: "",
  conditionMultipliers: DEFAULT_CONDITION_MULTIPLIERS,
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
  saveUsedLinks(getUsedLinks().filter((l) => l.collectionEntryId !== id));
}

// Precio unitario (en GTQ) de una entrada, usado para decidir si es "bulk".
// Fracción del precio de mercado que vale una carta según su condición
// (ej. NM = 100%, DMG = 30%), configurable en Ajustes.
export function conditionMultiplier(condition: string, settings: AppSettings): number {
  return settings.conditionMultipliers[condition] ?? 1;
}

// Precio de una sola copia, ya ajustado por su condición.
export function entryUnitValueUsd(entry: CollectionEntry, settings: AppSettings): number {
  if (entry.priceUsd == null) return 0;
  return entry.priceUsd * conditionMultiplier(entry.condition, settings);
}

// Valor total de una entrada (precio ajustado por condición × cantidad).
export function entryValueUsd(entry: CollectionEntry, settings: AppSettings): number {
  return entryUnitValueUsd(entry, settings) * entry.quantity;
}

// Valor de venta total de una entrada: usa el precio de venta propio si lo
// definiste, si no cae al precio de mercado ajustado por condición.
export function entryAskingValueUsd(entry: CollectionEntry, settings: AppSettings): number {
  const unit = entry.askingPriceUsd ?? entryUnitValueUsd(entry, settings);
  return unit * entry.quantity;
}

export function entryUnitPriceGtq(entry: CollectionEntry, settings: AppSettings): number {
  return entryUnitValueUsd(entry, settings) * settings.exchangeRate;
}

// Una carta es "bulk" si el usuario la marcó manualmente, o si el modo bulk
// está activo y su precio unitario (ya ajustado por condición) cae debajo
// del umbral configurado.
export function isEntryBulk(entry: CollectionEntry, settings: AppSettings): boolean {
  if (entry.markedBulk) return true;
  if (!settings.bulkModeEnabled) return false;
  return entryUnitPriceGtq(entry, settings) < settings.bulkThresholdGtq;
}

// Une entradas duplicadas que quedaron sueltas de antes de que existiera la
// agrupación automática al agregar cartas (misma carta+condición+idioma+holo,
// pero en filas separadas). Conserva la más antigua, le suma la cantidad de
// las demás, reasigna sus asignaciones a binders/mazos, y borra las
// duplicadas. Nunca mezcla holo con no-holo.
export function mergeDuplicateCollectionEntries(): { merged: number } {
  const entries = getCollection();
  const groups = new Map<string, CollectionEntry[]>();
  for (const e of entries) {
    const key = `${e.cardId}|${e.condition}|${e.language}|${e.isHolo}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  let allocations = getAllocations();
  const nextEntries: CollectionEntry[] = [];
  let merged = 0;

  for (const group of groups.values()) {
    if (group.length === 1) {
      nextEntries.push(group[0]);
      continue;
    }
    const sorted = [...group].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const survivor = sorted[0];
    const totalQty = sorted.reduce((sum, e) => sum + e.quantity, 0);
    nextEntries.push({ ...survivor, quantity: totalQty });
    merged += group.length - 1;

    const duplicateIds = new Set(sorted.slice(1).map((e) => e.id));
    allocations = allocations.map((a) =>
      duplicateIds.has(a.collectionEntryId) ? { ...a, collectionEntryId: survivor.id } : a
    );
  }

  // combina asignaciones que quedaron duplicadas (mismo contenedor + misma
  // entrada) después de reasignar las de arriba
  const combined = new Map<string, Allocation>();
  for (const a of allocations) {
    const key = `${a.containerId}|${a.collectionEntryId}`;
    const existing = combined.get(key);
    if (existing) existing.quantity += a.quantity;
    else combined.set(key, { ...a });
  }

  saveCollection(nextEntries);
  saveAllocations(Array.from(combined.values()));
  return { merged };
}

// ---------------------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------------------

export function getSettings(): AppSettings {
  const raw = readJson<Partial<AppSettings> | null>(SETTINGS_KEY, null);
  if (!raw) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    // merge profundo para no perder condiciones que no se hayan editado
    conditionMultipliers: {
      ...DEFAULT_CONDITION_MULTIPLIERS,
      ...(raw.conditionMultipliers ?? {}),
    },
  };
}

export function updateSettings(patch: Partial<AppSettings>) {
  writeJson(SETTINGS_KEY, { ...getSettings(), ...patch });
}

// ---------------------------------------------------------------------------
// Contenedores (binders y mazos)
// ---------------------------------------------------------------------------

export function getContainers(): Container[] {
  return readJson<Container[]>(CONTAINERS_KEY, []).map((container, index) => ({
    ...container,
    // Compatibilidad con datos creados antes de que existiera la relevancia.
    priority: Number.isFinite(container.priority) ? container.priority : index,
  }));
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
  saveUsedLinks(
    getUsedLinks().filter((l) => l.requestingContainerId !== id && l.holdingContainerId !== id)
  );
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
// Cuánto de una entrada está comprometido "en firme" — mazos y binders
// normales, sin contar los binders marcados como "de utilidad" (esas copias
// siguen contando como disponibles, ver getAvailableQuantity).
export function getHardAllocatedQuantity(collectionEntryId: string): number {
  return getAllocationsForEntry(collectionEntryId).reduce((sum, a) => {
    const container = getContainer(a.containerId);
    const isUtilityBinder = container?.type === "binder" && container.utilityForDecks;
    return isUtilityBinder ? sum : sum + a.quantity;
  }, 0);
}

// Cuánto de una entrada sigue SIN asignar a ningún binder/mazo firme — las
// copias que están en un binder "de utilidad" cuentan como disponibles.
export function getAvailableQuantity(collectionEntryId: string): number {
  const entry = getCollectionEntry(collectionEntryId);
  if (!entry) return 0;
  return Math.max(0, entry.quantity - getHardAllocatedQuantity(collectionEntryId));
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
  const available = getAvailableQuantity(collectionEntryId); // incluye binders de utilidad
  if (quantity > available) {
    return {
      ok: false,
      reason: `Solo tienes ${available} copia(s) sin asignar de esta carta.`,
    };
  }

  // Si lo que pediste no alcanza a cubrirse con copias 100% libres, el resto
  // se "recupera" de binders de utilidad (se les resta ahí) antes de
  // comprometerlo en el destino — una carta física no puede estar en dos
  // lugares a la vez.
  const trulyFree = Math.max(
    0,
    (getCollectionEntry(collectionEntryId)?.quantity ?? 0) -
      getAllocatedQuantity(collectionEntryId)
  );
  let stillNeeded = quantity - trulyFree;

  if (stillNeeded > 0) {
    const allocations = getAllocations();
    const utilitySources = allocations.filter((a) => {
      if (a.collectionEntryId !== collectionEntryId) return false;
      const c = getContainer(a.containerId);
      return c?.type === "binder" && c.utilityForDecks;
    });
    let next = allocations;
    for (const source of utilitySources) {
      if (stillNeeded <= 0) break;
      const take = Math.min(source.quantity, stillNeeded);
      stillNeeded -= take;
      const remaining = source.quantity - take;
      recordMove(
        getCollectionEntry(collectionEntryId)?.cardName ?? "carta",
        take,
        source.containerId,
        containerId,
        "manual"
      );
      next =
        remaining > 0
          ? next.map((a) => (a.id === source.id ? { ...a, quantity: remaining } : a))
          : next.filter((a) => a.id !== source.id);
    }
    saveAllocations(next);
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

// Libera todas las cartas asignadas a un binder/mazo (vuelven a estar
// disponibles sin asignar) SIN borrar el binder/mazo — útil cuando quieres
// reutilizar esas copias para armar algo nuevo pero no tienes suficientes
// cartas para tener ambos mazos completos a la vez. El binder/mazo queda
// vacío pero sigue existiendo (nombre, imagen, modo trabajo, etc. no se tocan).
export function releaseContainerAllocations(containerId: string): { released: number } {
  const allocations = getAllocations();
  const toRelease = allocations.filter((a) => a.containerId === containerId);
  const released = toRelease.reduce((sum, a) => sum + a.quantity, 0);
  saveAllocations(allocations.filter((a) => a.containerId !== containerId));
  return { released };
}

// "Limpiar mazo": libera las cartas asignadas (las copias físicas vuelven a
// estar disponibles para usarse en otro lado) pero el mazo NO se queda vacío
// de memoria — cada carta que tenía pasa a "cartas que faltan" (modo
// trabajo) con la misma cantidad, así conserva su lista/receta completa
// para poder rearmarlo después con otras copias. Solo tiene sentido en
// mazos (los binders no tienen concepto de "cartas que faltan").
export function releaseDeckToWorkSlots(deckId: string): { released: number } {
  const allocations = getAllocations().filter((a) => a.containerId === deckId);
  let released = 0;

  for (const alloc of allocations) {
    const entry = getCollectionEntry(alloc.collectionEntryId);
    if (!entry) continue;
    addWorkSlot({
      deckId,
      cardId: entry.cardId,
      cardName: entry.cardName,
      category: entry.category,
      trainerType: entry.trainerType,
      energyType: entry.energyType,
      setId: entry.setId,
      setName: entry.setName,
      setAbbreviation: entry.setAbbreviation,
      number: entry.number,
      regulationMark: entry.regulationMark,
      imageUrl: entry.imageUrl,
      quantity: alloc.quantity,
      priceUsd: entry.priceUsd,
      isGeneric: false,
      effectSignature: entry.effectSignature,
    });
    released += alloc.quantity;
  }

  saveAllocations(getAllocations().filter((a) => a.containerId !== deckId));
  updateContainer(deckId, { workMode: true });
  return { released };
}

// Mueve N copias de una entrada de un contenedor a otro (binder<->binder,
// binder<->mazo, mazo<->mazo).
export function moveAllocation(
  allocationId: string,
  toContainerId: string,
  quantity: number
): { ok: boolean; reason?: string } {
  const source = getAllocations().find((a) => a.id === allocationId);
  if (!source) return { ok: false, reason: "No se encontró la asignación." };
  if (quantity <= 0 || quantity > source.quantity) {
    return { ok: false, reason: "Cantidad inválida." };
  }
  return transferAllocation(
    source.containerId,
    toContainerId,
    source.collectionEntryId,
    quantity,
    "manual"
  );
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

// ---------------------------------------------------------------------------
// Lista de deseos (independiente de binders/mazos — cartas que quieres
// conseguir, sin importar para qué las vayas a usar)
// ---------------------------------------------------------------------------

export type WishlistPriority = "low" | "medium" | "high";

export interface WishlistItem {
  id: string;
  cardId: string;
  cardName: string;
  category: CardCategory;
  setId: string;
  setName: string;
  number: string;
  imageUrl: string;
  priceUsd: number | null;
  priority: WishlistPriority;
  notes: string | null;
  createdAt: string;
}

const WISHLIST_KEY = "pokedex-tcg:wishlist";

export function getWishlist(): WishlistItem[] {
  return readJson<WishlistItem[]>(WISHLIST_KEY, []);
}

function saveWishlist(items: WishlistItem[]) {
  writeJson(WISHLIST_KEY, items);
}

export function addWishlistItem(data: Omit<WishlistItem, "id" | "createdAt">): WishlistItem {
  const existing = getWishlist().find((i) => i.cardId === data.cardId);
  if (existing) return existing; // ya está en la lista, no se duplica
  const item: WishlistItem = { ...data, id: generateId(), createdAt: new Date().toISOString() };
  saveWishlist([item, ...getWishlist()]);
  return item;
}

export function updateWishlistItem(id: string, patch: Partial<WishlistItem>) {
  saveWishlist(getWishlist().map((i) => (i.id === id ? { ...i, ...patch } : i)));
}

export function removeWishlistItem(id: string) {
  saveWishlist(getWishlist().filter((i) => i.id !== id));
}

export function isInWishlist(cardId: string): boolean {
  return getWishlist().some((i) => i.cardId === cardId);
}

// ---------------------------------------------------------------------------
// Registro de ventas (binders) — "un registro en vez de una memoria": queda
// constancia de qué vendiste, cuándo y a qué precio, en vez de tener que
// acordarte o llevarlo en un chat aparte.
// ---------------------------------------------------------------------------

export interface SaleRecord {
  id: string;
  cardId: string;
  cardName: string;
  setName: string;
  number: string;
  imageUrl: string;
  quantity: number;
  priceUsd: number; // precio real al que se vendió (por copia)
  buyerNote: string | null;
  soldAt: string;
}

const SALES_KEY = "pokedex-tcg:sales";

export function getSales(): SaleRecord[] {
  return readJson<SaleRecord[]>(SALES_KEY, []);
}

function saveSales(sales: SaleRecord[]) {
  writeJson(SALES_KEY, sales);
}

export function removeSaleRecord(id: string) {
  saveSales(getSales().filter((s) => s.id !== id));
}

// Vende N copias de una entrada desde un binder puntual: le baja la cantidad
// a la entrada (y la borra si llega a 0), quita esa cantidad de la
// asignación de ese binder, y deja un renglón en el registro de ventas.
export function sellFromBinder(
  binderId: string,
  collectionEntryId: string,
  quantity: number,
  priceUsd: number,
  buyerNote: string | null
): { ok: boolean; reason?: string } {
  if (quantity <= 0) return { ok: false, reason: "Cantidad inválida." };

  const entry = getCollectionEntry(collectionEntryId);
  if (!entry) return { ok: false, reason: "No se encontró la carta." };

  const allocations = getAllocations();
  const alloc = allocations.find(
    (a) => a.containerId === binderId && a.collectionEntryId === collectionEntryId
  );
  if (!alloc || alloc.quantity < quantity) {
    return { ok: false, reason: "No tienes esa cantidad asignada a este binder." };
  }

  // baja (o borra) la asignación del binder
  const remainingAlloc = alloc.quantity - quantity;
  saveAllocations(
    remainingAlloc > 0
      ? allocations.map((a) => (a.id === alloc.id ? { ...a, quantity: remainingAlloc } : a))
      : allocations.filter((a) => a.id !== alloc.id)
  );

  // baja (o borra) la entrada de la colección
  const remainingQty = entry.quantity - quantity;
  if (remainingQty > 0) {
    updateCollectionEntry(collectionEntryId, { quantity: remainingQty });
  } else {
    removeCollectionEntry(collectionEntryId);
  }

  saveSales([
    {
      id: generateId(),
      cardId: entry.cardId,
      cardName: entry.cardName,
      setName: entry.setName,
      number: entry.number,
      imageUrl: entry.imageUrl,
      quantity,
      priceUsd,
      buyerNote,
      soldAt: new Date().toISOString(),
    },
    ...getSales(),
  ]);

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Registro de movimientos: qué carta se movió, de qué mazo/binder a cuál.
// ---------------------------------------------------------------------------

export interface MoveLogEntry {
  id: string;
  cardName: string;
  quantity: number;
  fromContainerName: string;
  toContainerName: string;
  reason: "manual" | "reajuste"; // "Mover aquí" a mano, o el botón "Reajustar"
  movedAt: string;
}

const MOVE_LOG_KEY = "pokedex-tcg:movelog";
const MAX_MOVE_LOG = 200;

export function getMoveLog(): MoveLogEntry[] {
  return readJson<MoveLogEntry[]>(MOVE_LOG_KEY, []);
}

function recordMove(
  cardName: string,
  quantity: number,
  fromContainerId: string,
  toContainerId: string,
  reason: MoveLogEntry["reason"]
) {
  const entry: MoveLogEntry = {
    id: generateId(),
    cardName,
    quantity,
    fromContainerName: getContainer(fromContainerId)?.name ?? "(borrado)",
    toContainerName: getContainer(toContainerId)?.name ?? "(borrado)",
    reason,
    movedAt: new Date().toISOString(),
  };
  writeJson(MOVE_LOG_KEY, [entry, ...getMoveLog()].slice(0, MAX_MOVE_LOG));
}

export function clearMoveLog() {
  writeJson(MOVE_LOG_KEY, []);
}

// Transfiere N copias de una entrada de un contenedor a otro. Si el que la
// tenía es un MAZO, deja el vínculo recíproco de "usada en" (para poder
// regresarla). Si es un BINDER, no — ahí simplemente desaparece de origen,
// como un movimiento normal (los binders no tienen "cartas que faltan").
function transferAllocation(
  fromContainerId: string,
  toContainerId: string,
  collectionEntryId: string,
  quantity: number,
  reason: MoveLogEntry["reason"]
): { ok: boolean; reason?: string } {
  const allocations = getAllocations();
  const source = allocations.find(
    (a) => a.containerId === fromContainerId && a.collectionEntryId === collectionEntryId
  );
  if (!source || source.quantity < quantity) {
    return { ok: false, reason: "Esa carta ya no está disponible ahí." };
  }

  const remaining = source.quantity - quantity;
  let next = remaining > 0
    ? allocations.map((a) => (a.id === source.id ? { ...a, quantity: remaining } : a))
    : allocations.filter((a) => a.id !== source.id);

  const destExisting = next.find(
    (a) => a.containerId === toContainerId && a.collectionEntryId === collectionEntryId
  );
  next = destExisting
    ? next.map((a) => (a.id === destExisting.id ? { ...a, quantity: a.quantity + quantity } : a))
    : [...next, { id: generateId(), containerId: toContainerId, collectionEntryId, quantity }];

  saveAllocations(next);

  let linksToSatisfy = quantity;
  const reconciledLinks: UsedElsewhereLink[] = [];
  for (const link of getUsedLinks()) {
    const isSatisfied =
      linksToSatisfy > 0 &&
      link.requestingContainerId === toContainerId &&
      link.holdingContainerId === fromContainerId &&
      link.collectionEntryId === collectionEntryId;
    if (!isSatisfied) {
      reconciledLinks.push(link);
      continue;
    }
    const consumed = Math.min(link.quantity, linksToSatisfy);
    linksToSatisfy -= consumed;
    if (link.quantity > consumed) {
      reconciledLinks.push({ ...link, quantity: link.quantity - consumed });
    }
  }
  saveUsedLinks(reconciledLinks);

  const destination = getContainer(toContainerId);
  const movedEntry = getCollectionEntry(collectionEntryId);
  if (destination?.type === "deck" && movedEntry) {
    let quantityToResolve = quantity;
    const nextSlots: WorkSlot[] = [];
    for (const slot of getWorkSlots()) {
      if (
        quantityToResolve <= 0 ||
        slot.deckId !== toContainerId ||
        slot.isGeneric ||
        !workSlotMatchesEntry(slot, movedEntry)
      ) {
        nextSlots.push(slot);
        continue;
      }
      const resolved = Math.min(slot.quantity, quantityToResolve);
      quantityToResolve -= resolved;
      if (slot.quantity > resolved) {
        nextSlots.push({ ...slot, quantity: slot.quantity - resolved });
      }
    }
    saveWorkSlots(nextSlots);
  }

  const fromContainer = getContainer(fromContainerId);
  if (fromContainer?.type === "deck") {
    createUsedElsewhereLink(fromContainerId, toContainerId, collectionEntryId, quantity);
  }

  recordMove(movedEntry?.cardName ?? "carta", quantity, fromContainerId, toContainerId, reason);

  return { ok: true };
}

// ---------------------------------------------------------------------------
// "Usada en otro mazo/binder": cuando una carta que necesitas en un mazo ya
// la tienes, pero está comprometida en otro binder/mazo (no libre), en vez
// de registrarla como "falta comprar" se deja un vínculo — aparece marcada
// como "usada en <el otro>" con la opción "Mover aquí". Al moverla, el
// espacio en el otro mazo NO se borra (solo si el otro es un mazo — los
// binders no guardan referencia, ahí sí desaparece): se convierte en el
// vínculo recíproco (ahora ESE lado la pide de vuelta, con su propio "Mover
// aquí"), así siempre se puede regresar sin perder el lugar.
// ---------------------------------------------------------------------------

export interface UsedElsewhereLink {
  id: string;
  requestingContainerId: string; // el mazo/binder que la necesita (donde se ve "usada")
  holdingContainerId: string; // el mazo/binder que la tiene físicamente ahora
  collectionEntryId: string;
  quantity: number;
  createdAt: string;
}

const USED_LINKS_KEY = "pokedex-tcg:usedlinks";

export function getUsedLinks(): UsedElsewhereLink[] {
  return readJson<UsedElsewhereLink[]>(USED_LINKS_KEY, []);
}

function saveUsedLinks(links: UsedElsewhereLink[]) {
  writeJson(USED_LINKS_KEY, links);
}

export function getUsedLinksRequestedBy(containerId: string): UsedElsewhereLink[] {
  return getUsedLinks().filter((l) => l.requestingContainerId === containerId);
}

export function getUsedLinksHeldBy(containerId: string): UsedElsewhereLink[] {
  return getUsedLinks().filter((l) => l.holdingContainerId === containerId);
}

export function createUsedElsewhereLink(
  requestingContainerId: string,
  holdingContainerId: string,
  collectionEntryId: string,
  quantity: number
): UsedElsewhereLink {
  const links = getUsedLinks();
  const existing = links.find(
    (link) =>
      link.requestingContainerId === requestingContainerId &&
      link.holdingContainerId === holdingContainerId &&
      link.collectionEntryId === collectionEntryId
  );
  if (existing) {
    const updated = { ...existing, quantity: existing.quantity + quantity };
    saveUsedLinks(links.map((link) => (link.id === existing.id ? updated : link)));
    return updated;
  }
  const link: UsedElsewhereLink = {
    id: generateId(),
    requestingContainerId,
    holdingContainerId,
    collectionEntryId,
    quantity,
    createdAt: new Date().toISOString(),
  };
  saveUsedLinks([link, ...links]);
  return link;
}

// Quita el vínculo sin mover nada (por si ya no la necesitas ahí).
export function removeUsedElsewhereLink(linkId: string) {
  saveUsedLinks(getUsedLinks().filter((l) => l.id !== linkId));
}

// "Mover aquí": mueve la asignación física de donde está a donde se pidió,
// y deja el vínculo recíproco en el lado que la tenía, para poder regresarla.
export function fulfillUsedElsewhereLink(
  linkId: string
): { ok: boolean; reason?: string } {
  const link = getUsedLinks().find((l) => l.id === linkId);
  if (!link) return { ok: false, reason: "No se encontró la referencia." };

  // se borra este vínculo primero: transferAllocation crea uno nuevo si el
  // que tenía la carta es un mazo (el recíproco), o ninguno si es un binder.
  saveUsedLinks(getUsedLinks().filter((l) => l.id !== linkId));

  const result = transferAllocation(
    link.holdingContainerId,
    link.requestingContainerId,
    link.collectionEntryId,
    link.quantity,
    "manual"
  );
  if (!result.ok) {
    return { ok: false, reason: result.reason ?? "Esa carta ya no está disponible ahí — se quitó la referencia." };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Prioridad de mazos y "Reajustar"
// ---------------------------------------------------------------------------

// Sube o baja un mazo un lugar en la lista de prioridad.
export function reorderDeckPriority(deckId: string, direction: "up" | "down") {
  const decks = getContainers()
    .filter((c) => c.type === "deck")
    .sort((a, b) => a.priority - b.priority);
  const idx = decks.findIndex((d) => d.id === deckId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swapIdx < 0 || swapIdx >= decks.length) return;

  [decks[idx], decks[swapIdx]] = [decks[swapIdx], decks[idx]];
  const order = new Map(decks.map((deck, index) => [deck.id, index]));
  saveContainers(
    getContainers().map((container) =>
      container.type === "deck"
        ? { ...container, priority: order.get(container.id) ?? container.priority }
        : container
    )
  );
}

// "Reajustar": recorre los mazos en orden de prioridad (los de más arriba
// primero) y, por cada carta que le falte a un mazo, revisa si algún mazo
// de MENOR prioridad ya la tiene — si es así, se la quita a ese y se la da
// al de mayor prioridad (dejando en el de menor prioridad la referencia de
// "usada en", para poder recuperarla después). Así el mazo principal queda
// completo primero, y los de más abajo se quedan con lo que sobra.
export function runDeckReajuste(): { movedCount: number } {
  const decks = getContainers()
    .filter((c) => c.type === "deck")
    .sort((a, b) => a.priority - b.priority);

  let movedCount = 0;

  for (const deck of decks) {
    const lowerDecks = decks.filter((d) => d.priority > deck.priority);

    // Primero atiende referencias existentes de “usada en” cuando la copia
    // está en un mazo de menor relevancia.
    for (const link of getUsedLinksRequestedBy(deck.id)) {
      if (!lowerDecks.some((lower) => lower.id === link.holdingContainerId)) continue;
      const source = getAllocations().find(
        (allocation) =>
          allocation.containerId === link.holdingContainerId &&
          allocation.collectionEntryId === link.collectionEntryId
      );
      const take = Math.min(link.quantity, source?.quantity ?? 0);
      if (take <= 0) {
        saveUsedLinks(getUsedLinks().filter((item) => item.id !== link.id));
        continue;
      }
      const result = transferAllocation(
        link.holdingContainerId,
        deck.id,
        link.collectionEntryId,
        take,
        "reajuste"
      );
      if (result.ok) {
        movedCount += take;
      }
    }

    const slots = getWorkSlotsForDeck(deck.id).filter((w) => !w.isGeneric);

    for (const slot of slots) {
      let remaining = slot.quantity;
      if (remaining <= 0) continue;

      for (const lowerDeck of lowerDecks) {
        if (remaining <= 0) break;
        const allocs = getAllocationsForContainer(lowerDeck.id);
        for (const alloc of allocs) {
          if (remaining <= 0) break;
          const entry = getCollectionEntry(alloc.collectionEntryId);
          if (!entry) continue;
          if (!workSlotMatchesEntry(slot, entry)) continue;

          const take = Math.min(alloc.quantity, remaining);
          if (take <= 0) continue;
          const result = transferAllocation(lowerDeck.id, deck.id, entry.id, take, "reajuste");
          if (result.ok) {
            remaining -= take;
            movedCount += take;
          }
        }
      }

    }
  }

  return { movedCount };
}

function workSlotMatchesEntry(slot: WorkSlot, entry: CollectionEntry): boolean {
  if (slot.category !== entry.category || slot.cardName !== entry.cardName) return false;
  if (slot.category !== "Pokemon") return true;
  return (
    slot.cardId === entry.cardId ||
    (!!slot.effectSignature && slot.effectSignature === entry.effectSignature)
  );
}
