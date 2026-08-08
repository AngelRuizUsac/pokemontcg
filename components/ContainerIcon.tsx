import Image from "next/image";
import type { ContainerImage } from "@/lib/storage";

export const ICON_GALLERY: { id: string; label: string; color: string }[] = [
  { id: "poke", label: "Poké Ball", color: "#FF6B6B" },
  { id: "great", label: "Great Ball", color: "#4FA8E0" },
  { id: "ultra", label: "Ultra Ball", color: "#F5B942" },
  { id: "master", label: "Master Ball", color: "#B98BFF" },
  { id: "premier", label: "Premier Ball", color: "#F2F1EC" },
  { id: "energy", label: "Energía", color: "#3DDC97" },
  { id: "binder", label: "Binder", color: "#4FE0D8" },
  { id: "deck", label: "Mazo", color: "#FF8FC7" },
];

function iconColor(id: string): string {
  return ICON_GALLERY.find((i) => i.id === id)?.color ?? "#F5B942";
}

const DEFAULT_IMAGE: ContainerImage = { kind: "icon", icon: "poke" };

export default function ContainerIcon({
  image,
  size = 40,
  className = "",
}: {
  image?: ContainerImage | null;
  size?: number;
  className?: string;
}) {
  const safeImage = image && image.kind ? image : DEFAULT_IMAGE;

  if (safeImage.kind === "card" && safeImage.cardImageUrl) {
    return (
      <div
        className={`relative rounded-full overflow-hidden shrink-0 bg-ink-900 ${className}`}
        style={{ width: size, height: size }}
      >
        <Image src={safeImage.cardImageUrl} alt="" fill className="object-cover" />
      </div>
    );
  }

  const color = safeImage.color ?? iconColor(safeImage.icon ?? "poke");

  return (
    <div
      className={`relative rounded-full shrink-0 overflow-hidden border-2 border-ink-900 ${className}`}
      style={{ width: size, height: size, backgroundColor: "#F2F1EC" }}
    >
      <div
        className="absolute inset-x-0 top-0"
        style={{ height: size / 2, backgroundColor: color }}
      />
      <div
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-ink-900"
        style={{ height: Math.max(2, size * 0.09) }}
      />
      <div
        className="absolute rounded-full border-2 border-ink-900 bg-ink-50"
        style={{
          width: size * 0.34,
          height: size * 0.34,
          left: "50%",
          top: "50%",
          transform: "translate(-50%,-50%)",
        }}
      />
    </div>
  );
}
