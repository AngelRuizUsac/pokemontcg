"use client";

import { useEffect, useState } from "react";
import { getSales, removeSaleRecord, getSettings } from "@/lib/storage";
import type { SaleRecord } from "@/lib/storage";
import { DEFAULT_EXCHANGE_RATE, formatGtq, formatUsd, usdToGtq } from "@/lib/currency";
import CardImage from "@/components/CardImage";

export default function VentasPage() {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [exchangeRate, setExchangeRate] = useState(DEFAULT_EXCHANGE_RATE);

  useEffect(() => {
    setSales(getSales());
    setExchangeRate(getSettings().exchangeRate);
  }, []);

  const totalUsd = sales.reduce((s, sale) => s + sale.priceUsd * sale.quantity, 0);
  const totalUnits = sales.reduce((s, sale) => s + sale.quantity, 0);

  function undo(id: string) {
    if (!confirm("¿Borrar este registro de venta? Esto NO devuelve la carta a tu colección, solo quita la constancia.")) return;
    removeSaleRecord(id);
    setSales(getSales());
  }

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl">Historial de ventas</h1>
          <p className="text-ink-400 text-sm mt-1">
            Registro de lo que has vendido desde tus binders — con precio y fecha, para no
            depender de la memoria.
          </p>
        </div>
        {sales.length > 0 && (
          <div className="bg-ink-800 border border-ink-700 rounded-card px-5 py-3">
            <p className="text-ink-400 text-[11px] uppercase tracking-wide">Total vendido</p>
            <p className="font-mono text-xl text-grass mt-0.5">
              {formatGtq(usdToGtq(totalUsd, exchangeRate))}
            </p>
            <p className="font-mono text-xs text-ink-400">
              {formatUsd(totalUsd)} · {totalUnits} carta(s)
            </p>
          </div>
        )}
      </div>

      {sales.length === 0 ? (
        <p className="text-ink-400 text-sm mt-8">Todavía no has registrado ninguna venta.</p>
      ) : (
        <div className="mt-8 flex flex-col gap-2">
          {sales.map((sale) => (
            <div key={sale.id} className="flex items-center gap-3 bg-ink-800 border border-ink-700 rounded-lg p-2.5">
              <div className="relative w-11 aspect-[5/7] rounded overflow-hidden bg-ink-900 shrink-0">
                <CardImage src={sale.imageUrl} alt={sale.cardName} className="object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {sale.cardName} <span className="text-ink-400 font-mono">x{sale.quantity}</span>
                </p>
                <p className="text-ink-400 text-xs">
                  {sale.setName} · #{sale.number} ·{" "}
                  {new Date(sale.soldAt).toLocaleDateString("es-GT", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                {sale.buyerNote && <p className="text-ink-400 text-[11px] italic">{sale.buyerNote}</p>}
              </div>
              <p className="font-mono text-sm text-grass shrink-0">
                {formatUsd(sale.priceUsd * sale.quantity)}
              </p>
              <button onClick={() => undo(sale.id)} className="text-xs text-danger/80 hover:text-danger shrink-0">
                Borrar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
