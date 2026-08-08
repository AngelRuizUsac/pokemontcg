"use client";

import Image from "next/image";
import type { ContainerImage } from "@/lib/storage";
import ContainerIcon, { ICON_GALLERY } from "./ContainerIcon";

export default function ContainerImagePicker({
  candidateImages,
  onSelect,
  onClose,
}: {
  candidateImages: { url: string; label: string }[];
  onSelect: (image: ContainerImage) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-ink-800 border border-ink-700 rounded-card max-w-md w-full p-5 max-h-[80vh] overflow-y-auto scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-display font-semibold mb-3">Ícono de la galería</p>
        <div className="grid grid-cols-4 gap-3">
          {ICON_GALLERY.map((icon) => (
            <button
              key={icon.id}
              onClick={() =>
                onSelect({ kind: "icon", icon: icon.id, color: icon.color })
              }
              className="flex flex-col items-center gap-1.5 p-2 rounded hover:bg-ink-700"
            >
              <ContainerIcon image={{ kind: "icon", icon: icon.id, color: icon.color }} size={44} />
              <span className="text-[10px] text-ink-400">{icon.label}</span>
            </button>
          ))}
        </div>

        {candidateImages.length > 0 && (
          <>
            <p className="font-display font-semibold mt-6 mb-3">
              Usar una carta de este contenedor
            </p>
            <div className="grid grid-cols-4 gap-3">
              {candidateImages.map((c, i) => (
                <button
                  key={`${c.url}-${i}`}
                  onClick={() => onSelect({ kind: "card", cardImageUrl: c.url })}
                  className="relative aspect-square rounded-full overflow-hidden bg-ink-900 border-2 border-ink-700 hover:border-gold/60"
                  title={c.label}
                >
                  <Image src={c.url} alt={c.label} fill className="object-cover" />
                </button>
              ))}
            </div>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full text-sm px-4 py-2 rounded-full text-ink-400 hover:text-ink-50"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
