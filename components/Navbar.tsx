"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Mi colección" },
  { href: "/colecciones/", label: "Colecciones" },
  { href: "/deseos/", label: "Deseos" },
  { href: "/compras/", label: "Lista de compra" },
  { href: "/ventas/", label: "Ventas" },
  { href: "/buscar/", label: "Buscar cartas" },
  { href: "/metajuego/", label: "Metajuego" },
  { href: "/estadisticas/", label: "Estadísticas" },
  { href: "/ajustes/", label: "Ajustes" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="border-b border-ink-700 bg-ink-850/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
        <Link href="/" className="font-display font-bold text-lg tracking-tight">
          <span className="holo-text">Pokédex</span>{" "}
          <span className="text-ink-100">TCG</span>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : link.href === "/colecciones/"
                ? pathname.startsWith("/colecciones") || pathname.startsWith("/coleccion/") || pathname.startsWith("/ver")
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? "bg-ink-700 text-ink-50"
                    : "text-ink-400 hover:text-ink-50 hover:bg-ink-800"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
