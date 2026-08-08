// Energías básicas: siempre existen, cualquier jugador tiene acceso a
// cuantas necesite, así que se pueden agregar a un mazo sin tenerlas en la
// colección ni buscarlas en la API.
export interface GenericEnergy {
  id: string; // usado como "cardId" sintético del WorkSlot (isGeneric: true)
  name: string;
  color: string;
}

export const GENERIC_BASIC_ENERGIES: GenericEnergy[] = [
  { id: "generic-energy-grass", name: "Grass Energy", color: "#3DDC97" },
  { id: "generic-energy-fire", name: "Fire Energy", color: "#FF6B6B" },
  { id: "generic-energy-water", name: "Water Energy", color: "#4FA8E0" },
  { id: "generic-energy-lightning", name: "Lightning Energy", color: "#F5D742" },
  { id: "generic-energy-psychic", name: "Psychic Energy", color: "#B98BFF" },
  { id: "generic-energy-fighting", name: "Fighting Energy", color: "#C9932A" },
  { id: "generic-energy-darkness", name: "Darkness Energy", color: "#3A3D46" },
  { id: "generic-energy-metal", name: "Metal Energy", color: "#8B8E98" },
];
