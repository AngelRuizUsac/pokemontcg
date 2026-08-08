import Image from "next/image";
import ContainerIcon from "./ContainerIcon";

export default function CardImage({
  src,
  alt,
  className = "",
  sizes,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  if (!src) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-ink-900">
        <ContainerIcon image={{ kind: "icon", icon: "poke" }} size={36} />
      </div>
    );
  }

  return <Image src={src} alt={alt} fill sizes={sizes} className={className} />;
}
