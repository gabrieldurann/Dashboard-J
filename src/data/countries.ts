// Country reference for sales-per-country (PLAN.md §9 Phase 2). A sale stores only the ISO
// `pais` code; name, flag and globe coordinates are derived from here. Coordinates use each
// country's main economic hub so globe markers land on a recognizable city.

export type Pais = {
  code: string; // ISO 3166-1 alpha-2
  nome: string; // pt-BR display name
  flag: string; // emoji flag
  lat: number;
  lng: number;
};

export const PAISES: Pais[] = [
  { code: "BR", nome: "Brasil", flag: "🇧🇷", lat: -23.55, lng: -46.63 }, // São Paulo
  { code: "US", nome: "Estados Unidos", flag: "🇺🇸", lat: 40.71, lng: -74.0 }, // New York
  { code: "CA", nome: "Canadá", flag: "🇨🇦", lat: 43.65, lng: -79.38 }, // Toronto
  { code: "MX", nome: "México", flag: "🇲🇽", lat: 19.43, lng: -99.13 }, // Cidade do México
  { code: "GB", nome: "Reino Unido", flag: "🇬🇧", lat: 51.51, lng: -0.13 }, // Londres
  { code: "PT", nome: "Portugal", flag: "🇵🇹", lat: 38.72, lng: -9.14 }, // Lisboa
  { code: "ES", nome: "Espanha", flag: "🇪🇸", lat: 40.42, lng: -3.7 }, // Madri
  { code: "FR", nome: "França", flag: "🇫🇷", lat: 48.85, lng: 2.35 }, // Paris
  { code: "DE", nome: "Alemanha", flag: "🇩🇪", lat: 52.52, lng: 13.4 }, // Berlim
  { code: "IT", nome: "Itália", flag: "🇮🇹", lat: 41.9, lng: 12.5 }, // Roma
  { code: "JP", nome: "Japão", flag: "🇯🇵", lat: 35.68, lng: 139.69 }, // Tóquio
  { code: "AU", nome: "Austrália", flag: "🇦🇺", lat: -33.87, lng: 151.21 }, // Sydney
];

const PAIS_POR_CODE = new Map(PAISES.map((p) => [p.code, p]));

export const paisByCode = (code?: string): Pais | undefined =>
  code ? PAIS_POR_CODE.get(code) : undefined;

export const paisNome = (code?: string): string => paisByCode(code)?.nome ?? "—";
export const paisFlag = (code?: string): string => paisByCode(code)?.flag ?? "🏳️";
