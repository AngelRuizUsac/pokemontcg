import { mkdir, readFile, writeFile } from "node:fs/promises";

const output = new URL("../public/data/limitless-official.json", import.meta.url);
const root = "https://limitlesstcg.com";
const limit = 16;

const decode = (value) => value
  .replace(/<[^>]*>/g, " ")
  .replace(/&amp;/g, "&").replace(/&#039;|&apos;/g, "'")
  .replace(/&quot;/g, '"').replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ").trim();

async function get(path) {
  const response = await fetch(`${root}${path}`, { headers: { "user-agent": "Pokedex-TCG build sync" } });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.text();
}

function parseTournaments(html) {
  return [...html.matchAll(/<tr\s+data-date="([^"]+)"\s+data-country="([^"]*)"\s+data-name="([^"]+)"\s+data-format="([^"]+)"\s+data-players="(\d+)"[\s\S]*?<a href="\/tournaments\/(\d+)">/g)]
    .slice(0, limit)
    .map((match) => ({ id: match[6], date: match[1], country: match[2], name: decode(match[3]), format: match[4], players: Number(match[5]) }));
}

function parseDecklists(html) {
  // Las 32 mejores listas dan una muestra competitiva útil sin convertir la
  // descarga inicial de GitHub Pages en un archivo innecesariamente grande.
  const allStarts = [...html.matchAll(/<div class="tournament-decklist">/g)].map((match) => match.index ?? 0);
  const starts = allStarts.slice(0, 32);
  return starts.map((start, index) => html.slice(start, allStarts[index + 1] ?? html.length)).map((block) => {
    const toggle = block.match(/class="decklist-toggle"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
    const placingMatch = decode(toggle).match(/^(\d+)(?:st|nd|rd|th)\s+(.+)$/i);
    const archetype = decode(block.match(/class="decklist-title">([\s\S]*?)(?:<a|<span|<\/div>)/)?.[1] ?? "Arquetipo sin identificar");
    let section = "Pokemon";
    const decklist = { pokemon: [], trainer: [], energy: [] };
    const tokenPattern = /class="decklist-column-heading">([\s\S]*?)<\/div>|class="decklist-card"\s+data-set="([^"]*)"\s+data-number="([^"]*)"[\s\S]*?class="card-count">(\d+)<\/span>[\s\S]*?class="card-name">([\s\S]*?)<\/span>/g;
    for (const token of block.matchAll(tokenPattern)) {
      if (token[1]) {
        const heading = decode(token[1]).toLowerCase();
        section = heading.includes("trainer") ? "Trainer" : heading.includes("energ") ? "Energy" : "Pokemon";
      } else {
        const card = { set: token[2], number: token[3], count: Number(token[4]), name: decode(token[5]) };
        decklist[section.toLowerCase()].push(card);
      }
    }
    return { player: placingMatch?.[2] ?? decode(toggle), name: placingMatch?.[2] ?? decode(toggle), placing: Number(placingMatch?.[1] ?? 999), deck: { name: archetype }, decklist };
  }).filter((row) => row.player && Object.values(row.decklist).some((cards) => cards.length));
}

try {
  const tournaments = parseTournaments(await get("/tournaments"));
  for (const tournament of tournaments) {
    tournament.standings = parseDecklists(await get(`/tournaments/${tournament.id}/decklists`));
  }
  await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
  await writeFile(output, JSON.stringify({ updatedAt: new Date().toISOString(), tournaments }, null, 2) + "\n");
  console.log(`Limitless: ${tournaments.length} torneos oficiales actualizados.`);
} catch (error) {
  try {
    JSON.parse(await readFile(output, "utf8"));
    console.warn(`Limitless no respondió; se conserva la instantánea anterior. ${error.message}`);
  } catch {
    throw error;
  }
}
