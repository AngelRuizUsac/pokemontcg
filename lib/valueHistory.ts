// Historial de valor de la colección: como no hay backend, se guarda una
// "foto" del valor total cada día que abres la app (sin duplicar si ya
// hay una del día de hoy), para poder mostrar la tendencia con el tiempo.

export interface ValueSnapshot {
  date: string; // "YYYY-MM-DD"
  totalUsd: number;
}

const HISTORY_KEY = "pokedex-tcg:valueHistory";
const MAX_SNAPSHOTS = 180;

function isBrowser() {
  return typeof window !== "undefined";
}

export function getValueHistory(): ValueSnapshot[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as ValueSnapshot[]) : [];
  } catch {
    return [];
  }
}

// Registra el valor de hoy (reemplaza la foto de hoy si ya existía una, en
// vez de duplicarla). Se llama cada vez que se abre Mi colección/Estadísticas.
export function recordValueSnapshot(totalUsd: number) {
  if (!isBrowser()) return;
  const today = new Date().toISOString().slice(0, 10);
  const history = getValueHistory().filter((s) => s.date !== today);
  history.push({ date: today, totalUsd });
  history.sort((a, b) => a.date.localeCompare(b.date));
  const trimmed = history.slice(-MAX_SNAPSHOTS);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

// Diferencia entre el valor de hoy y el valor de hace N días (o el registro
// más antiguo disponible, si hay menos de N días de historial).
export function getValueChange(
  history: ValueSnapshot[],
  days: number
): { from: number; to: number; diff: number } | null {
  if (history.length < 2) return null;
  const to = history[history.length - 1].totalUsd;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const past = [...history].reverse().find((s) => s.date <= cutoffStr) ?? history[0];
  return { from: past.totalUsd, to, diff: to - past.totalUsd };
}
