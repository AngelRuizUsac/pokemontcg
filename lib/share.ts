// Genera un enlace "de vista": todos los datos necesarios para mostrar un
// binder o mazo de forma solo-lectura viajan codificados en el propio enlace
// (después del #), así que no hace falta ningún servidor para compartirlo —
// coherente con que esta app no usa base de datos.

import type { ContainerType, ContainerImage } from "./storage";

export interface ShareItem {
  cardId: string; // id de TCGdex
  quantity: number;
  askingPriceUsd?: number | null; // precio de venta propio (binders), si lo pusiste
}

export interface SharePayload {
  v: 1;
  type: ContainerType;
  name: string;
  image: ContainerImage;
  items: ShareItem[]; // cartas que sí se poseen (o del mazo)
  missing: ShareItem[]; // solo mazos: cartas que faltan (modo trabajo)
}

export function encodeSharePayload(payload: SharePayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function padBase64(s: string): string {
  const remainder = s.length % 4;
  return remainder === 0 ? s : s + "=".repeat(4 - remainder);
}

export function decodeSharePayload(encoded: string): SharePayload | null {
  try {
    const restored = padBase64(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const binary = atob(restored);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const payload = JSON.parse(json) as SharePayload;
    if (payload.v !== 1) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildShareUrl(payload: SharePayload): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const encoded = encodeSharePayload(payload);
  return `${window.location.origin}${basePath}/ver/#d=${encoded}`;
}
