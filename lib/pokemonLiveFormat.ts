// Formato de importación/exportación de mazos de Pokémon TCG Live:
//
// Pokémon: 19
// 4 Dreepy TWM 128
// ...
//
// Trainer: 33
// 4 Ultra Ball MEG 131
// ...
//
// Energy: 8
// 3 Psychic Energy MEE 5
// ...

export type DeckSection = "Pokemon" | "Trainer" | "Energy";

export interface DeckListLine {
  quantity: number;
  name: string;
  setCode: string;
  number: string;
  section: DeckSection;
  imageUrl?: string;
}

const SECTION_BY_HEADER: Record<string, DeckSection> = {
  "pokémon": "Pokemon",
  pokemon: "Pokemon",
  trainer: "Trainer",
  energy: "Energy",
};

const SECTION_LABEL: Record<DeckSection, string> = {
  Pokemon: "Pokémon",
  Trainer: "Trainer",
  Energy: "Energy",
};

export function parseDeckListText(text: string): {
  lines: DeckListLine[];
  unrecognized: string[];
} {
  const lines: DeckListLine[] = [];
  const unrecognized: string[] = [];
  let currentSection: DeckSection | null = null;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const headerMatch = line.match(/^(Pokémon|Pokemon|Trainer|Energy)\s*:\s*\d+$/i);
    if (headerMatch) {
      currentSection = SECTION_BY_HEADER[headerMatch[1].toLowerCase()] ?? null;
      continue;
    }

    // "4 Dreepy TWM 128" -> cantidad, nombre, código de set, número
    const cardMatch = line.match(/^(\d+)\s+(.+?)\s+([A-Z0-9]{2,5})\s+([A-Za-z0-9]+)$/);
    if (cardMatch && currentSection) {
      lines.push({
        quantity: Number(cardMatch[1]),
        name: cardMatch[2].trim(),
        setCode: cardMatch[3],
        number: cardMatch[4],
        section: currentSection,
      });
    } else {
      unrecognized.push(rawLine);
    }
  }

  return { lines, unrecognized };
}

export function generateDeckListText(
  rows: { quantity: number; name: string; setCode: string; number: string; section: DeckSection }[]
): string {
  const bySection: Record<DeckSection, typeof rows> = {
    Pokemon: [],
    Trainer: [],
    Energy: [],
  };
  rows.forEach((r) => bySection[r.section].push(r));

  const order: DeckSection[] = ["Pokemon", "Trainer", "Energy"];
  const blocks = order
    .filter((s) => bySection[s].length > 0)
    .map((s) => {
      const total = bySection[s].reduce((sum, r) => sum + r.quantity, 0);
      const body = bySection[s]
        .map((r) => `${r.quantity} ${r.name} ${r.setCode} ${r.number}`)
        .join("\n");
      return `${SECTION_LABEL[s]}: ${total}\n${body}`;
    });

  return blocks.join("\n\n");
}
