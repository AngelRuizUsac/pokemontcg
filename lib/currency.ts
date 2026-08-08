export const DEFAULT_EXCHANGE_RATE = 7.5; // Quetzales por 1 USD

export function usdToGtq(usd: number, rate: number = DEFAULT_EXCHANGE_RATE): number {
  return usd * rate;
}

export function formatUsd(usd: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(usd);
}

export function formatGtq(gtq: number): string {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
  }).format(gtq);
}
