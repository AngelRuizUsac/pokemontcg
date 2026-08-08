// Respaldo manual para resolver el código de Pokémon TCG Live de un set.
//
// TABLA POR ID: tiene prioridad porque varias entradas están CONFIRMADAS —
// se dedujeron viendo qué id devolvía TCGdex como respaldo (ej. exportar
// mostró "ME02.5 155" para una carta que en realidad es "ASC 155", lo que
// confirma que el id interno de ese set es "me02.5"). Las marcadas
// "confirmado" salieron así directo de una exportación real; el resto son
// inferencias razonables por el patrón de numeración de cada serie.
export const KNOWN_SET_CODES_BY_ID: Record<string, string> = {
  // Serie Scarlet & Violet (ids tipo "sv0X")
  sv01: "SVI",
  sv02: "PAL",
  sv03: "OBF",
  sv3pt5: "MEW",
  sv04: "PAR",
  sv4pt5: "PAF",
  sv05: "TEF", // confirmado
  sv06: "TWM", // confirmado
  sv6pt5: "SFA",
  sv07: "SCR",
  sv08: "SSP", // confirmado
  sv8pt5: "PRE",
  sv09: "JTG", // confirmado
  sv10: "DRI",

  // Serie Mega Evolution (ids tipo "meXX")
  me01: "MEG", // confirmado
  me02: "PFL",
  "me02.5": "ASC", // confirmado
  me2pt5: "ASC", // confirmado (variante de formato de id)
  me03: "POR", // confirmado
  "me03.5": "CRI",
  me3pt5: "CRI",
};

// Respaldo secundario: comparar por NOMBRE del set (normalizado). Sirve
// para sets que no están en la tabla de arriba.
export const KNOWN_SET_CODES_BY_NAME: Record<string, string> = {
  "mega evolution energy": "MEE",
  "mega evolution promos": "MEP",
  "mega evolution": "MEG",
  "ascended heroes": "ASC",
  "phantasmal flames": "PFL",
  "perfect order": "POR",
  "chaos rising": "CRI",
  "pitch black": "PBL",
  "white flare": "WHT",
  "black bolt": "BLK",
  "destined rivals": "DRI",
  "journey together": "JTG",
  "prismatic evolutions": "PRE",
  "surging sparks": "SSP",
  "stellar crown": "SCR",
  "shrouded fable": "SFA",
  "twilight masquerade": "TWM",
  "temporal forces": "TEF",
  "paldean fates": "PAF",
  "paradox rift": "PAR",
  "151": "MEW",
  "obsidian flames": "OBF",
  "paldea evolved": "PAL",
  "scarlet and violet energy": "SVE",
  "scarlet and violet promos": "SVP",
  "scarlet and violet": "SVI",
  "crown zenith": "CRZ",
  "silver tempest": "SIT",
  "lost origin": "LOR",
  "pokemon go": "PGO",
  "astral radiance": "ASR",
};

// "Pokémon TCG: Mega Evolution—Ascended Heroes" -> "pokemon tcg mega evolution ascended heroes"
export function normalizeSetName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
