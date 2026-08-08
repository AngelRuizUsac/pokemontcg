import type { DeckLegalityResult } from "@/lib/deckLegality";

export default function DeckLegalityPanel({
  result,
  checkingReprints,
}: {
  result: DeckLegalityResult;
  checkingReprints?: boolean;
}) {
  const hasIssues =
    !result.countOk || result.copyViolations.length > 0 || result.regulationViolations.length > 0;

  return (
    <div
      className={`mt-4 rounded-card px-4 py-3 border ${
        hasIssues ? "bg-danger/10 border-danger/30" : "bg-grass/10 border-grass/30"
      }`}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className={`text-sm font-medium ${hasIssues ? "text-danger" : "text-grass"}`}>
          {hasIssues ? "Este mazo tiene problemas de legalidad" : "Mazo legal ✓"}
        </p>
        <p className="text-xs font-mono text-ink-400">
          {result.totalCards}/60 cartas
        </p>
      </div>

      {!result.countOk && (
        <p className="text-xs text-ink-100 mt-1.5">
          {result.totalCards < 60
            ? `Faltan ${60 - result.totalCards} cartas para completar las 60.`
            : `Tiene ${result.totalCards - 60} cartas de más — un mazo debe tener exactamente 60.`}
        </p>
      )}

      {result.copyViolations.length > 0 && (
        <div className="mt-1.5">
          <p className="text-xs text-ink-100">Más de 4 copias (máximo permitido, salvo energía básica):</p>
          <ul className="text-xs text-danger mt-0.5 list-disc list-inside">
            {result.copyViolations.map((v) => (
              <li key={v.name}>
                {v.name} · x{v.count}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.regulationChecked && result.regulationViolations.length > 0 && (
        <div className="mt-1.5">
          <p className="text-xs text-ink-100">
            Fuera del formato Standard configurado en Ajustes
            {checkingReprints && " (revisando reimpresiones de Trainer/Energy…)"}:
          </p>
          <ul className="text-xs text-danger mt-0.5 list-disc list-inside">
            {result.regulationViolations.map((v, i) => (
              <li key={`${v.name}-${i}`}>
                {v.name} · marca {v.mark}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!result.regulationChecked && (
        <p className="text-ink-400 text-[11px] mt-1.5">
          No se está revisando la regulation mark — configura el rango del formato Standard en Ajustes
          para activarlo.
        </p>
      )}
    </div>
  );
}
