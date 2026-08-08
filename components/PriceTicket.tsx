import { formatGtq, formatUsd, usdToGtq } from "@/lib/currency";

export default function PriceTicket({
  priceUsd,
  exchangeRate,
  tcgPlayerUrl,
  size = "md",
}: {
  priceUsd: number | null;
  exchangeRate: number;
  tcgPlayerUrl?: string | null;
  size?: "sm" | "md";
}) {
  const padding = size === "sm" ? "px-2.5 py-1" : "px-3 py-1.5";
  const text = size === "sm" ? "text-[11px]" : "text-xs";

  if (priceUsd == null) {
    const content = (
      <div className="relative ticket-notch bg-ink-700 text-ink-400 text-xs font-mono px-3 py-1.5 rounded border border-dashed border-ink-600">
        {tcgPlayerUrl ? "ver en TCGPlayer" : "sin precio"}
      </div>
    );
    return tcgPlayerUrl ? (
      <a href={tcgPlayerUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
        {content}
      </a>
    ) : (
      content
    );
  }

  const gtq = usdToGtq(priceUsd, exchangeRate);

  const content = (
    <div
      className={`relative ticket-notch flex items-baseline gap-2 bg-ink-700/80 border border-dashed border-ink-600 rounded font-mono ${padding} ${text} ${
        tcgPlayerUrl ? "hover:border-gold/50 cursor-pointer" : ""
      }`}
    >
      <span className="text-gold font-medium">{formatGtq(gtq)}</span>
      <span className="text-ink-400">·</span>
      <span className="text-ink-100">{formatUsd(priceUsd)}</span>
    </div>
  );

  return tcgPlayerUrl ? (
    <a href={tcgPlayerUrl} target="_blank" rel="noopener noreferrer" title="Ver en TCGPlayer">
      {content}
    </a>
  ) : (
    content
  );
}
