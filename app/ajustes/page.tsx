"use client";

import { useEffect, useState } from "react";
import { getSettings, updateSettings } from "@/lib/storage";
import { DEFAULT_EXCHANGE_RATE, formatGtq, usdToGtq } from "@/lib/currency";
import { buildFullBackup, downloadJson, isFullBackup, restoreFullBackup, downloadCollectionCsv } from "@/lib/exportImport";

const CONDITIONS: { value: string; label: string }[] = [
  { value: "NM", label: "Casi nueva (NM)" },
  { value: "LP", label: "Ligero desgaste (LP)" },
  { value: "MP", label: "Desgaste moderado (MP)" },
  { value: "HP", label: "Muy desgastada (HP)" },
  { value: "DMG", label: "Dañada (DMG)" },
];

export default function AjustesPage() {
  const [rate, setRate] = useState(DEFAULT_EXCHANGE_RATE);
  const [bulkEnabled, setBulkEnabled] = useState(false);
  const [bulkThreshold, setBulkThreshold] = useState(5);
  const [markFrom, setMarkFrom] = useState("");
  const [markTo, setMarkTo] = useState("");
  const [conditionMultipliers, setConditionMultipliers] = useState<Record<string, number>>({
    NM: 1,
    LP: 0.85,
    MP: 0.7,
    HP: 0.5,
    DMG: 0.3,
  });
  const [saved, setSaved] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

  useEffect(() => {
    const s = getSettings();
    setRate(s.exchangeRate);
    setBulkEnabled(s.bulkModeEnabled);
    setBulkThreshold(s.bulkThresholdGtq);
    setMarkFrom(s.standardMarkFrom);
    setMarkTo(s.standardMarkTo);
    setConditionMultipliers(s.conditionMultipliers);
  }, []);

  function save() {
    updateSettings({
      exchangeRate: rate,
      bulkModeEnabled: bulkEnabled,
      bulkThresholdGtq: bulkThreshold,
      standardMarkFrom: markFrom,
      standardMarkTo: markTo,
      conditionMultipliers,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function exportAll() {
    const backup = buildFullBackup();
    downloadJson(
      `pokedex-tcg-respaldo-${new Date().toISOString().slice(0, 10)}.json`,
      backup
    );
  }

  function importAll(file: File) {
    setRestoreMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!isFullBackup(data)) {
          setRestoreMsg("Ese archivo no parece ser un respaldo válido de esta app.");
          return;
        }
        if (
          !confirm(
            "Esto reemplazará TODA tu colección, binders y mazos actuales por los del respaldo. ¿Continuar?"
          )
        ) {
          return;
        }
        restoreFullBackup(data);
        setRestoreMsg("Respaldo restaurado. Recargando…");
        setTimeout(() => window.location.reload(), 800);
      } catch {
        setRestoreMsg("No se pudo leer el archivo.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="max-w-md flex flex-col gap-8">
      <div>
        <h1 className="font-display font-bold text-2xl">Ajustes</h1>
        <p className="text-ink-400 text-sm mt-1">
          Define el tipo de cambio usado para convertir los precios de TCGPlayer (USD) a quetzales.
          Se guarda en este navegador.
        </p>

        <div className="mt-6 bg-ink-800 border border-ink-700 rounded-card p-5">
          <label className="text-xs text-ink-400 flex flex-col gap-1.5">
            Tipo de cambio (GTQ por 1 USD)
            <input
              type="number"
              step="0.01"
              min={0.01}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="bg-ink-900 border border-ink-700 rounded px-3 py-2 text-ink-50 font-mono text-lg"
            />
          </label>

          <p className="text-ink-400 text-xs mt-3 font-mono">
            Ejemplo: {formatGtq(usdToGtq(10, rate))} = $10.00
          </p>

          <button
            onClick={save}
            className="mt-4 w-full px-4 py-2.5 rounded-full bg-gold text-ink-900 text-sm font-medium hover:bg-gold-light"
          >
            Guardar tipo de cambio
          </button>

          {saved && <p className="text-grass text-xs mt-2 text-center">Guardado ✓</p>}
        </div>
      </div>

      <div>
        <h2 className="font-display font-semibold text-lg">Formato Standard</h2>
        <p className="text-ink-400 text-sm mt-1">
          Rango de regulation mark que consideras vigente para el formato Standard — se usa para
          revisar la legalidad de tus mazos. Déjalo vacío si no quieres revisar este punto.
        </p>

        <div className="mt-4 bg-ink-800 border border-ink-700 rounded-card p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-ink-400 flex flex-col gap-1.5">
              De
              <input
                value={markFrom}
                onChange={(e) => setMarkFrom(e.target.value.slice(0, 1).toUpperCase())}
                placeholder="G"
                maxLength={1}
                className="w-16 bg-ink-900 border border-ink-700 rounded px-2 py-1.5 text-ink-50 font-mono text-center"
              />
            </label>
            <label className="text-xs text-ink-400 flex flex-col gap-1.5">
              A (opcional)
              <input
                value={markTo}
                onChange={(e) => setMarkTo(e.target.value.slice(0, 1).toUpperCase())}
                placeholder="J"
                maxLength={1}
                className="w-16 bg-ink-900 border border-ink-700 rounded px-2 py-1.5 text-ink-50 font-mono text-center"
              />
            </label>
          </div>

          <button
            onClick={save}
            className="px-4 py-2.5 rounded-full bg-gold text-ink-900 text-sm font-medium hover:bg-gold-light"
          >
            Guardar formato Standard
          </button>
        </div>
      </div>

      <div>
        <h2 className="font-display font-semibold text-lg">Precio según condición</h2>
        <p className="text-ink-400 text-sm mt-1">
          Qué porcentaje del precio de mercado vale una carta según su condición — así el valor de
          tu colección refleja mejor tu inventario real, no solo copias perfectas.
        </p>

        <div className="mt-4 bg-ink-800 border border-ink-700 rounded-card p-5 flex flex-col gap-3">
          {CONDITIONS.map((c) => (
            <div key={c.value} className="flex items-center gap-3">
              <label className="text-xs text-ink-400 w-40 shrink-0">{c.label}</label>
              <input
                type="number"
                min={0}
                max={100}
                step="1"
                value={Math.round((conditionMultipliers[c.value] ?? 1) * 100)}
                onChange={(e) =>
                  setConditionMultipliers((m) => ({
                    ...m,
                    [c.value]: Math.max(0, Math.min(100, Number(e.target.value))) / 100,
                  }))
                }
                className="w-20 bg-ink-900 border border-ink-700 rounded px-2 py-1.5 text-ink-50 font-mono text-sm"
              />
              <span className="text-ink-400 text-xs">%</span>
            </div>
          ))}

          <button
            onClick={save}
            className="mt-1 px-4 py-2.5 rounded-full bg-gold text-ink-900 text-sm font-medium hover:bg-gold-light"
          >
            Guardar precios por condición
          </button>
        </div>
      </div>

      <div>
        <h2 className="font-display font-semibold text-lg">Modo bulk</h2>
        <p className="text-ink-400 text-sm mt-1">
          Oculta por defecto en Mi colección las cartas de bajo valor (puedes mostrarlas de nuevo
          con el filtro "Mostrar bulk"). También puedes marcar cartas específicas como bulk a mano,
          sin importar su precio.
        </p>

        <div className="mt-4 bg-ink-800 border border-ink-700 rounded-card p-5 flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-100">
            <input
              type="checkbox"
              checked={bulkEnabled}
              onChange={(e) => setBulkEnabled(e.target.checked)}
              className="accent-gold"
            />
            Activar modo bulk automático por precio
          </label>

          <label className="text-xs text-ink-400 flex flex-col gap-1.5">
            Ocultar cartas con precio unitario menor a (GTQ)
            <input
              type="number"
              step="0.5"
              min={0}
              value={bulkThreshold}
              onChange={(e) => setBulkThreshold(Number(e.target.value))}
              className="bg-ink-900 border border-ink-700 rounded px-3 py-2 text-ink-50 font-mono"
            />
          </label>

          <button
            onClick={save}
            className="px-4 py-2.5 rounded-full bg-gold text-ink-900 text-sm font-medium hover:bg-gold-light"
          >
            Guardar ajustes de bulk
          </button>
        </div>
      </div>

      <div>
        <h2 className="font-display font-semibold text-lg">Respaldo completo</h2>
        <p className="text-ink-400 text-sm mt-1">
          Todo vive en este navegador. Exporta un respaldo completo (colección, binders, mazos y
          ajustes) para guardarlo o moverlo a otro dispositivo, y restáuralo cuando lo necesites.
        </p>

        <div className="mt-4 bg-ink-800 border border-ink-700 rounded-card p-5 flex flex-col gap-3">
          <button
            onClick={exportAll}
            className="w-full px-4 py-2.5 rounded-full bg-gold text-ink-900 text-sm font-medium hover:bg-gold-light"
          >
            Descargar respaldo completo (.json)
          </button>

          <button
            onClick={downloadCollectionCsv}
            className="w-full px-4 py-2.5 rounded-full bg-ink-700 text-ink-100 text-sm font-medium hover:bg-ink-600"
          >
            Exportar colección a CSV (Excel/Sheets)
          </button>

          <div>
            <label className="text-xs text-ink-400 block mb-1.5">Restaurar desde un respaldo</label>
            <input
              type="file"
              accept="application/json"
              onChange={(e) => e.target.files?.[0] && importAll(e.target.files[0])}
              className="text-xs text-ink-400"
            />
          </div>

          {restoreMsg && <p className="text-ink-100 text-xs">{restoreMsg}</p>}
        </div>
      </div>
    </div>
  );
}
