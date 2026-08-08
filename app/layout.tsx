import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Pokédex TCG · Mi colección",
  description: "Registro personal de cartas Pokémon TCG, precios y colección.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body
        className={`${display.variable} ${body.variable} ${mono.variable} font-body bg-ink text-ink-50 min-h-screen`}
      >
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-24 pt-8">
          {children}
        </main>
      </body>
    </html>
  );
}
