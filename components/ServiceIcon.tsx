import type { ReactNode } from "react";

type ServiceIconKey =
  | "okna-nowe"
  | "okna-wymiana"
  | "okna-alu"
  | "drzwi-wejsciowe"
  | "drzwi-alu"
  | "brama-garazowa"
  | "zabudowa-tarasu"
  | "zadaszenie-tarasu"
  | "ogrod-letni"
  | "ogrodzenie"
  | "balustrada"
  | "konstrukcja"
  | "zaluzja"
  | "roleta"
  | "pergola"
  | "sciany-szklane"
  | "dodatki"
  | "inne";

const REFRESH_BADGE = (
  <g transform="translate(14.5 1.5) scale(0.32)">
    <path vectorEffect="non-scaling-stroke" d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path vectorEffect="non-scaling-stroke" d="M21 3v5h-5" />
  </g>
);

const ICONS: Record<ServiceIconKey, ReactNode> = {
  // Okno PCV z plusem (nowa inwestycja)
  "okna-nowe": (
    <>
      <rect x="2" y="6" width="12" height="15" rx="1" />
      <path d="M8 6v15M2 13h12" />
      <path d="M19 2v6M16 5h6" />
    </>
  ),
  // Okno PCV ze strzałką wymiany
  "okna-wymiana": (
    <>
      <rect x="2" y="6" width="12" height="15" rx="1" />
      <path d="M8 6v15M2 13h12" />
      {REFRESH_BADGE}
    </>
  ),
  // Okno aluminiowe — smukła podwójna rama z refleksami szkła
  "okna-alu": (
    <>
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <rect x="5.5" y="5.5" width="13" height="13" />
      <path d="M12 5.5v13" />
      <path d="M7.5 10l2-2M14 10l2-2" />
    </>
  ),
  // Drzwi wejściowe — płyciny i klamka
  "drzwi-wejsciowe": (
    <>
      <path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17" />
      <path d="M3 21h18" />
      <rect x="8.5" y="5.5" width="6" height="5" rx="0.5" />
      <rect x="8.5" y="12.5" width="6" height="6" rx="0.5" />
      <path d="M16.3 11v2.5" />
    </>
  ),
  // Drzwi aluminiowe — przeszklenie i pochwyt
  "drzwi-alu": (
    <>
      <path d="M6 21V3h12v18" />
      <path d="M3 21h18" />
      <rect x="8.5" y="5.5" width="6.5" height="13" />
      <path d="M10 9.5l2.5-2.5M10 13l4-4" />
      <path d="M16.6 9v6" />
    </>
  ),
  // Brama garażowa segmentowa
  "brama-garazowa": (
    <>
      <path d="M2 21V9l10-6 10 6v12" />
      <path d="M5.5 21v-9.5h13V21" />
      <path d="M5.5 14.5h13M5.5 17.5h13" />
    </>
  ),
  // Zabudowa tarasu — ściana budynku, dach i przeszklone ściany
  "zabudowa-tarasu": (
    <>
      <path d="M3 21V3" />
      <path d="M3 6l18 3v12" />
      <path d="M2 21h20" />
      <path d="M9 7v14M15 8v13" />
      <path d="M5 13l2-2M11 14l2-2M17 15l2-2" />
    </>
  ),
  // Zadaszenie tarasu — dach na słupie przy ścianie, stolik pod spodem
  "zadaszenie-tarasu": (
    <>
      <path d="M3 21V3" />
      <path d="M3 6l19 3.5v2L3 8" />
      <path d="M19 11v10" />
      <path d="M2 21h20" />
      <path d="M7 16h7M8.5 16v5M12.5 16v5" />
    </>
  ),
  // Ogród letni — szklany pawilon z roślinką
  "ogrod-letni": (
    <>
      <path d="M2.5 10.5L12 4l9.5 6.5" />
      <path d="M4.5 9.2V21h15V9.2" />
      <path d="M8 21V12.5M16 21V12.5M4.5 12.5h15" />
      <path d="M12 21v-4" />
      <path d="M12 18c0-1.6 1-2.6 2.3-2.6 0 1.6-1 2.6-2.3 2.6z" />
      <path d="M12 19c0-1.6-1-2.6-2.3-2.6 0 1.6 1 2.6 2.3 2.6z" />
    </>
  ),
  // Ogrodzenie aluminiowe — słupki i poziome sztachety
  ogrodzenie: (
    <>
      <path d="M4 4v17M12 4v17M20 4v17" />
      <path d="M3 4h2M11 4h2M19 4h2" />
      <path d="M4 7.5h16M4 11h16M4 14.5h16M4 18h16" />
      <path d="M2 21h20" />
    </>
  ),
  // Balustrada szklana — pochwyt, słupki, panele szklane, płyta balkonu
  balustrada: (
    <>
      <rect x="2" y="5" width="20" height="2" rx="1" />
      <path d="M4.5 7v11M12 7v11M19.5 7v11" />
      <path d="M2 18h20v3H2z" />
      <path d="M6.5 12l2.5-2.5M14 12l2.5-2.5" />
    </>
  ),
  // Konstrukcja aluminiowa — rama portalowa z kratownicą
  konstrukcja: (
    <>
      <path d="M3 21V5h18v16" />
      <path d="M3 9h18" />
      <path d="M3 9l4.5-4 4.5 4 4.5-4 4.5 4" />
      <path d="M1.5 21h3M19.5 21h3" />
    </>
  ),
  // Żaluzja — kaseta, lamele i drabinki
  zaluzja: (
    <>
      <rect x="3" y="3" width="18" height="3" rx="0.5" />
      <path d="M4 9h16M4 12h16M4 15h16M4 18h16" />
      <path d="M8 6v12M16 6v12" />
    </>
  ),
  // Roleta — rura nawojowa, pancerz i listwa dolna z uchwytem
  roleta: (
    <>
      <rect x="3" y="3" width="18" height="4" rx="2" />
      <path d="M5 7v7.5M19 7v7.5" />
      <path d="M5 10h14M5 12.5h14" />
      <rect x="4" y="14.5" width="16" height="1.5" rx="0.5" />
      <path d="M12 16v2.5" />
      <circle cx="12" cy="19.5" r="1" />
    </>
  ),
  // Pergola lamelowa — słupy, rama i lamele dachu
  pergola: (
    <>
      <path d="M2 7h20M2 10h20" />
      <path d="M4 10v11M20 10v11" />
      <path d="M5 3.5L4 7M9 3.5L8 7M13 3.5L12 7M17 3.5L16 7M21 3.5L20 7" />
      <path d="M2 21h20" />
    </>
  ),
  // Ściany szklane przesuwne — panele szkła i strzałka przesuwu
  "sciany-szklane": (
    <>
      <rect x="2" y="2" width="20" height="16" rx="1" />
      <path d="M8.7 2v16M15.3 2v16" />
      <path d="M4 7.5l2.5-2.5M10.5 7.5l2.5-2.5M17 7.5l2.5-2.5" />
      <path d="M7 21.5h10M15 19.8l2 1.7-2 1.7" />
    </>
  ),
  // Dodatki do zamówień — paczka
  dodatki: (
    <>
      <path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z" />
      <path d="M3 7.5l9 4.5 9-4.5M12 12v9" />
      <path d="M7.5 5.3l9 4.5" />
    </>
  ),
  // Inne — kafelki z plusem
  inne: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <path d="M17.25 14v6.5M14 17.25h6.5" />
    </>
  ),
};

function resolveServiceIconKey(serviceName: string): ServiceIconKey {
  const n = serviceName.toLowerCase();
  if (n.includes("okn")) {
    if (n.includes("wymian")) return "okna-wymiana";
    if (n.includes("alu")) return "okna-alu";
    return "okna-nowe";
  }
  if (n.includes("drzwi")) return n.includes("alu") ? "drzwi-alu" : "drzwi-wejsciowe";
  if (n.includes("brama") || n.includes("garaż")) return "brama-garazowa";
  if (n.includes("zabudow")) return "zabudowa-tarasu";
  if (n.includes("zadaszen")) return "zadaszenie-tarasu";
  if (n.includes("ogrodzen")) return "ogrodzenie";
  if (n.includes("ogród") || n.includes("ogrod")) return "ogrod-letni";
  if (n.includes("balustrad")) return "balustrada";
  if (n.includes("konstrukcj")) return "konstrukcja";
  if (n.includes("żaluz") || n.includes("zaluz")) return "zaluzja";
  if (n.includes("rolet")) return "roleta";
  if (n.includes("pergol")) return "pergola";
  if (n.includes("ścian") || n.includes("scian") || n.includes("szkl")) return "sciany-szklane";
  if (n.includes("dodat")) return "dodatki";
  return "inne";
}

export default function ServiceIcon({
  name,
  className = "w-5 h-5",
}: Readonly<{ name: string; className?: string }>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[resolveServiceIconKey(name)]}
    </svg>
  );
}
