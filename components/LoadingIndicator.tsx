export default function LoadingIndicator({ label = "Cargando…", compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div className={`flex items-center ${compact ? "inline-flex gap-1.5" : "justify-center gap-3 py-10"}`} role="status" aria-live="polite">
      <span className={`${compact ? "h-3.5 w-3.5 border-2" : "h-7 w-7 border-[3px]"} inline-block animate-spin rounded-full border-gold/25 border-t-gold`} aria-hidden="true" />
      <span className={compact ? "text-xs" : "text-sm text-ink-400"}>{label}</span>
    </div>
  );
}
