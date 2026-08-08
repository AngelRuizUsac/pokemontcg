export const CARD_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todos los tipos" },
  { value: "pokemon", label: "Pokémon" },
  { value: "trainer", label: "Trainer (todos)" },
  { value: "trainer-item", label: "Trainer · Item" },
  { value: "trainer-supporter", label: "Trainer · Supporter" },
  { value: "trainer-stadium", label: "Trainer · Stadium" },
  { value: "trainer-tool", label: "Trainer · Tool" },
  { value: "energy", label: "Energy (todas)" },
  { value: "energy-basic", label: "Energy · Basic" },
  { value: "energy-special", label: "Energy · Special" },
];

export function matchesCardTypeFilter(
  filterValue: string,
  category: string,
  trainerType?: string | null,
  energyType?: string | null
): boolean {
  if (!filterValue) return true;

  if (filterValue === "pokemon") return category === "Pokemon";
  if (filterValue === "trainer") return category === "Trainer";
  if (filterValue === "energy") return category === "Energy";

  if (filterValue.startsWith("trainer-")) {
    const sub = filterValue.replace("trainer-", "");
    return category === "Trainer" && (trainerType ?? "").toLowerCase() === sub;
  }

  if (filterValue.startsWith("energy-")) {
    const sub = filterValue.replace("energy-", "");
    return category === "Energy" && (energyType ?? "").toLowerCase() === sub;
  }

  return true;
}
