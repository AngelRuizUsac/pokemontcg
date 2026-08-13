import type { Allocation, CollectionEntry, WorkSlot } from "@/lib/storage";

interface Row {
  entry: CollectionEntry;
  alloc: Allocation;
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  if (value === 0) return null;
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-ink-100">{label}</span>
        <span className="text-ink-400 font-mono">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-ink-900 overflow-hidden">
        <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DeckCompositionPanel({
  rows,
  workSlots,
}: {
  rows: Row[];
  workSlots: WorkSlot[];
}) {
  const counts = { Pokemon: 0, Trainer: 0, Energy: 0 } as Record<string, number>;
  const trainerSub = { Item: 0, Supporter: 0, Stadium: 0, Tool: 0, Otro: 0 } as Record<string, number>;
  const energySub = { Basic: 0, Special: 0 } as Record<string, number>;

  function tally(category: string, qty: number, trainerType: string | null, energyType: string | null) {
    counts[category] = (counts[category] ?? 0) + qty;
    if (category === "Trainer") {
      const key = trainerType && trainerSub[trainerType] != null ? trainerType : "Otro";
      trainerSub[key] += qty;
    }
    if (category === "Energy") {
      const key = energyType === "Special" ? "Special" : "Basic";
      energySub[key] += qty;
    }
  }

  rows.forEach((r) => tally(r.entry.category, r.alloc.quantity, r.entry.trainerType, r.entry.energyType));
  workSlots.forEach((w) => tally(w.category, w.quantity, w.trainerType, w.energyType));

  const total = counts.Pokemon + counts.Trainer + counts.Energy;
  if (total === 0) return null;

  return (
    <div className="mt-6 bg-ink-800 border border-ink-700 rounded-card p-4">
      <h2 className="font-display font-semibold text-sm mb-3">Composición del mazo</h2>
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-ink-400 text-[10px] uppercase tracking-wide">Por categoría</p>
          <Bar label="Pokémon" value={counts.Pokemon} max={total} />
          <Bar label="Trainer" value={counts.Trainer} max={total} />
          <Bar label="Energy" value={counts.Energy} max={total} />
        </div>
        {counts.Trainer > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-ink-400 text-[10px] uppercase tracking-wide">Trainer por subtipo</p>
            {Object.entries(trainerSub).map(([label, value]) => (
              <Bar key={label} label={label} value={value} max={counts.Trainer} />
            ))}
          </div>
        )}
        {counts.Energy > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-ink-400 text-[10px] uppercase tracking-wide">Energy por subtipo</p>
            {Object.entries(energySub).map(([label, value]) => (
              <Bar key={label} label={label} value={value} max={counts.Energy} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
