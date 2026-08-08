// Respaldo completo de la app: todo lo que vive en localStorage, en un solo
// archivo JSON descargable. Sirve para mover tus datos a otro dispositivo o
// como copia de seguridad, ya que no hay ninguna base de datos remota.

import {
  getCollection,
  getSettings,
  getContainers,
  getAllocations,
  getWorkSlots,
} from "./storage";
import type {
  CollectionEntry,
  AppSettings,
  Container,
  Allocation,
  WorkSlot,
} from "./storage";

export interface FullBackup {
  v: 1;
  exportedAt: string;
  collection: CollectionEntry[];
  settings: AppSettings;
  containers: Container[];
  allocations: Allocation[];
  workSlots: WorkSlot[];
}

export function buildFullBackup(): FullBackup {
  return {
    v: 1,
    exportedAt: new Date().toISOString(),
    collection: getCollection(),
    settings: getSettings(),
    containers: getContainers(),
    allocations: getAllocations(),
    workSlots: getWorkSlots(),
  };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function isFullBackup(data: unknown): data is FullBackup {
  return (
    !!data &&
    typeof data === "object" &&
    (data as FullBackup).v === 1 &&
    Array.isArray((data as FullBackup).collection) &&
    Array.isArray((data as FullBackup).containers)
  );
}

export function restoreFullBackup(backup: FullBackup) {
  window.localStorage.setItem(
    "pokedex-tcg:collection",
    JSON.stringify(backup.collection)
  );
  window.localStorage.setItem(
    "pokedex-tcg:settings",
    JSON.stringify(backup.settings)
  );
  window.localStorage.setItem(
    "pokedex-tcg:containers",
    JSON.stringify(backup.containers)
  );
  window.localStorage.setItem(
    "pokedex-tcg:allocations",
    JSON.stringify(backup.allocations)
  );
  window.localStorage.setItem(
    "pokedex-tcg:workslots",
    JSON.stringify(backup.workSlots)
  );
}
