"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCollection, getSettings, isEntryBulk } from "@/lib/storage";
import type { CollectionEntry, AppSettings } from "@/lib/storage";
import { DEFAULT_EXCHANGE_RATE, formatGtq, formatUsd, usdToGtq } from "@/lib/currency";
import CardImage from "@/components/CardImage";
import ValueSparkline from "@/components/ValueSparkline";
import { recordValueSnapshot, getValueHistory, getValueChange } from "@/lib/valueHistory";
import type { ValueSnapshot } from "@/lib/valueHistory";
import { listSets } from "@/lib/tcgdex";
import type { SetBrief } from "@/lib/types";

const DEFAULT_SETTINGS: AppSettings = {
  exchangeRate: DEFAULT_EXCHANGE_RATE,
  bulkModeEnabled: false,
  bulkThresholdGtq: 5,
  standardMarkFrom: "",
  standardMarkTo: "",
};

function Bar({ label, value, max, formatted }: { label: string; value: number; max: number; formatted: string }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-ink-100">{label}</span>
        <span className="text-ink-400 font-mono">{formatted}</span>
      </div>
      <div className="h-2 rounded-full bg-ink-900 overflow-hidden">
        <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function EstadisticasPage() {
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [history, setHistory] = useState<ValueSnapshot[]>([]);
  const [sets, setSets] = useState<SetBrief[]>([]);

  useEffect(() => {
    const coll = getCollection();
    const s = getSettings();
    setEntries(coll);
    setSettings(s);
    setLoaded(true);

    const nonBulk = coll.filter((e) => !isEntryBulk(e, s));
    const total = nonBulk.reduce((sum, e) => sum + (e.priceUsd ?? 0) * e.quantity, 0);
    if (coll.length > 0) recordValueSnapshot(total);
    setHistory(getValueHistory());

    listSets()
      .then(setSets)
      .catch(() => {});
  }, []);

  if (!loaded) return <p className="text-ink-400 text-sm">Cargando…</p>;

  if (entries.length === 0) {
    return (
      <div className="text-center mt-16">
        <p className="text-ink-400">Todavía no tienes cartas registradas.</p>
        <Link
          href="/buscar/"
          className="inline-block mt-4 px-5 py-2.5 rounded-full bg-gold text-ink-900 text-sm font-medium hover:bg-gold-light"
        >
          Buscar mi primera carta
        </Link>
      </div>
    );
  }

  const totalUnits = entries.reduce((s, e) => s + e.quantity, 0);
  const bulkEntries = entries.filter((e) => isEntryBulk(e, settings));
  const bulkUsd = bulkEntries.reduce((s, e) => s + (e.priceUsd ?? 0) * e.quantity, 0);
  // Las cartas bulk no suman al valor total (ni al desglose por tipo).
  const nonBulkEntries = entries.filter((e) => !isEntryBulk(e, settings));
  const totalUsd = nonBulkEntries.reduce((s, e) => s + (e.priceUsd ?? 0) * e.quantity, 0);

  const byCategory = { Pokemon: 0, Trainer: 0, Energy: 0 } as Record<string, number>;
  const byCategoryUsd = { Pokemon: 0, Trainer: 0, Energy: 0 } as Record<string, number>;
  entries.forEach((e) => {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.quantity;
  });
  nonBulkEntries.forEach((e) => {
    byCategoryUsd[e.category] = (byCategoryUsd[e.category] ?? 0) + (e.priceUsd ?? 0) * e.quantity;
  });

  const bySet = new Map<string, number>();
  entries.forEach((e) => bySet.set(e.setName, (bySet.get(e.setName) ?? 0) + e.quantity));
  const topSets = Array.from(bySet.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxSetCount = topSets[0]?.[1] ?? 1;

  const topValuable = entries
    .filter((e) => e.priceUsd != null)
    .sort((a, b) => (b.priceUsd ?? 0) * b.quantity - (a.priceUsd ?? 0) * a.quantity)
    .slice(0, 10);

  const change7d = getValueChange(history, 7);

  // Progreso por expansión: cartas distintas que tienes vs. el total oficial del set.
  const ownedNumbersBySet = new Map<string, Set<string>>();
  entries.forEach((e) => {
    if (!ownedNumbersBySet.has(e.setId)) ownedNumbersBySet.set(e.setId, new Set());
    ownedNumbersBySet.get(e.setId)!.add(e.number);
  });
  const setProgress = Array.from(ownedNumbersBySet.entries())
    .map(([setId, numbers]) => {
      const setInfo = sets.find((s) => s.id === setId);
      if (!setInfo) return null;
      const total = setInfo.cardCount.official || setInfo.cardCount.total;
      return { name: setInfo.name, owned: numbers.size, total };
    })
    .filter((x): x is { name: string; owned: number; total: number } => x !== null && x.total > 0)
    .sort((a, b) => b.owned / b.total - a.owned / a.total)
    .slice(0, 8);

  return (
    <div>
      <h1 className="font-display font-bold text-2xl">Estadísticas</h1>
      <p className="text-ink-400 text-sm mt-1">Un vistazo general a tu colección.</p>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Valor total"
          value={formatGtq(usdToGtq(totalUsd, settings.exchangeRate))}
          sub={bulkEntries.length > 0 ? `${formatUsd(totalUsd)} · sin contar bulk` : formatUsd(totalUsd)}
        />
        <StatCard label="Cartas distintas" value={String(entries.length)} />
        <StatCard label="Unidades totales" value={String(totalUnits)} />
        <StatCard
          label="Bulk"
          value={String(bulkEntries.length)}
          sub={bulkUsd > 0 ? formatGtq(usdToGtq(bulkUsd, settings.exchangeRate)) : undefined}
        />
      </div>

      {history.length > 1 && (
        <div className="mt-6 bg-ink-800 border border-ink-700 rounded-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-sm">Valor en el tiempo</h2>
            {change7d && (
              <p className={`text-xs font-mono ${change7d.diff >= 0 ? "text-grass" : "text-danger"}`}>
                {change7d.diff >= 0 ? "+" : ""}
                {formatGtq(usdToGtq(change7d.diff, settings.exchangeRate))} últimos 7 días
              </p>
            )}
          </div>
          <ValueSparkline history={history} />
        </div>
      )}

      <div className="mt-8 grid md:grid-cols-2 gap-8">
        <div>
          <h2 className="font-display font-semibold text-lg mb-3">Por tipo</h2>
          <div className="bg-ink-800 border border-ink-700 rounded-card p-4 flex flex-col gap-3">
            {(["Pokemon", "Trainer", "Energy"] as const).map((cat) => (
              <Bar
                key={cat}
                label={cat === "Pokemon" ? "Pokémon" : cat}
                value={byCategory[cat] ?? 0}
                max={totalUnits}
                formatted={`${byCategory[cat] ?? 0} · ${formatGtq(usdToGtq(byCategoryUsd[cat] ?? 0, settings.exchangeRate))}`}
              />
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-display font-semibold text-lg mb-3">Expansiones más representadas</h2>
          <div className="bg-ink-800 border border-ink-700 rounded-card p-4 flex flex-col gap-3">
            {topSets.map(([name, count]) => (
              <Bar key={name} label={name} value={count} max={maxSetCount} formatted={String(count)} />
            ))}
          </div>
        </div>
      </div>

      {setProgress.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display font-semibold text-lg mb-3">Progreso por expansión</h2>
          <div className="bg-ink-800 border border-ink-700 rounded-card p-4 grid sm:grid-cols-2 gap-x-8 gap-y-3">
            {setProgress.map((s) => (
              <Bar
                key={s.name}
                label={s.name}
                value={s.owned}
                max={s.total}
                formatted={`${s.owned}/${s.total}`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="font-display font-semibold text-lg mb-3">Cartas más valiosas</h2>
        <div className="flex flex-col gap-2">
          {topValuable.map((e) => (
            <div key={e.id} className="flex items-center gap-3 bg-ink-800 border border-ink-700 rounded-lg p-2.5">
              <div className="relative w-10 aspect-[5/7] rounded overflow-hidden bg-ink-900 shrink-0">
                <CardImage src={e.imageUrl} alt={e.cardName} className="object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{e.cardName}</p>
                <p className="text-ink-400 text-xs">
                  {e.setName} · #{e.number} · x{e.quantity}
                </p>
              </div>
              <p className="font-mono text-sm text-gold">
                {formatGtq(usdToGtq((e.priceUsd ?? 0) * e.quantity, settings.exchangeRate))}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-ink-800 border border-ink-700 rounded-card p-4">
      <p className="text-ink-400 text-[11px] uppercase tracking-wide">{label}</p>
      <p className="font-mono text-lg text-gold mt-0.5">{value}</p>
      {sub && <p className="font-mono text-xs text-ink-400">{sub}</p>}
    </div>
  );
}
