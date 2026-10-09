export type WallType = "FRONT" | "SIDE";

export type AccessoryType =
  | "LAMELLA_FRONT"
  | "LAMELLA_SIDE"
  | "ADDON_TRIANGLE"
  | "ADDON_FOUNDATION"
  | "ADDON_PROFILE"
  | "ADDON_OTHER";

export type SidePlacement = "LEFT" | "RIGHT";

export interface WallInput {
  id: string;
  type: WallType;
  sidePlacement?: SidePlacement; // dla ścianek bocznych: LEFT (lewa) lub RIGHT (prawa)
  colorRal?: string; // np. "RAL 7016"
  slopeCm?: number; // spadek posadzki w cm, np. 3
  widthCm: number;
  heightCm: number;
  quantity: number;
  isExpanded?: boolean;
}

export interface AccessoryInput {
  id: string;
  type: AccessoryType;
  linkedWallId?: string; // ID ścianki, z której pobierany jest wymiar
  quantity: number;
  widthCm?: number; // dla trójkąta / fundamentu / lameli (jeśli brak powiązania lub nadpisanie)
  heightCm?: number;
  customDescription?: string; // dla Dodatek - inne / profil
  priceNetCost?: number; // koszt bazowy netto (jeśli ręczny lub domyślny)
  installNetCost?: number; // montaż koszt netto (jeśli ręczny lub domyślny)
  installNetClient?: number; // montaż klient netto
  isExpanded?: boolean;
}

export interface EnclosureInput {
  walls: WallInput[];
  accessories: AccessoryInput[];
  marginPercent: number; // np. 52
  glassPricePerSqm: number; // np. 225
  installFrontCost: number; // np. 250
  installFrontClient: number; // np. 300
  installSideCost: number; // np. 500
  installSideClient: number; // np. 650
  installTriangleCostPerMb: number; // 200
  installTriangleClientPerMb: number; // 250
  installFoundationCostPerMb: number; // 50
  installFoundationClientPerMb: number; // 100
}

export interface WallResult {
  id: string;
  type: WallType;
  quantity: number;
  widthCm: number;
  heightCm: number;
  standardWidthCm?: number;
  areaSqm: number;
  glassCostNet: number;
  profileCostNet: number;
  unitCostNet: number;
  unitClientNet: number;
  unitInstallCostNet: number;
  unitInstallClientNet: number;
  totalCostNet: number;
  totalClientNet: number;
  error?: string;
}

export interface AccessoryResult {
  id: string;
  type: AccessoryType;
  name: string;
  linkedWallId?: string;
  linkedWallLabel?: string;
  quantity: number;
  effectiveWidthCm: number;
  heightCm?: number;
  unitCostNet: number;
  unitClientNet: number;
  unitInstallCostNet: number;
  unitInstallClientNet: number;
  totalCostNet: number;
  totalClientNet: number;
}

export interface EnclosureResult {
  walls: WallResult[];
  accessories: AccessoryResult[];
  materialsCostNet: number;
  materialsClientNet: number;
  installationCostNet: number;
  installationClientNet: number;
  totalCostNet: number;
  totalClientNet: number;
  totalProfitZ: number;
}

// Baza profili standardowych co ~50cm (zgodnie z "NIESTANDARD bez szkła")
export const PROFILES = [
  { width: 94, baseFront: 1155, triangle: 854, foundation: 106, sideBase: 1155 },
  { width: 194, baseFront: 1155, triangle: 854, foundation: 106, sideBase: 1155 },
  { width: 241, baseFront: 1650, triangle: 854, foundation: 179, sideBase: 1650 },
  { width: 290, baseFront: 1650, triangle: 854, foundation: 179, sideBase: 1650 },
  { width: 337, baseFront: 2285, triangle: 1016, foundation: 272, sideBase: 2285 },
  { width: 386, baseFront: 2285, triangle: 1179, foundation: 272, sideBase: 2285 },
  { width: 433, baseFront: 3072, triangle: 1463, foundation: 382, sideBase: 3072 },
  { width: 482, baseFront: 3072, triangle: 1707, foundation: 382, sideBase: 3072 },
  { width: 529, baseFront: 4017, triangle: 2439, foundation: 618, sideBase: 4017 },
  { width: 578, baseFront: 4017, triangle: 2683, foundation: 618, sideBase: 4017 },
];

export function getStandardProfile(widthCm: number) {
  for (const p of PROFILES) {
    if (widthCm <= p.width) return p;
  }
  return null;
}

export function calculateGlassEnclosure(input: EnclosureInput): EnclosureResult {
  const result: EnclosureResult = {
    walls: [],
    accessories: [],
    materialsCostNet: 0,
    materialsClientNet: 0,
    installationCostNet: 0,
    installationClientNet: 0,
    totalCostNet: 0,
    totalClientNet: 0,
    totalProfitZ: 0,
  };

  const marginMultiplier = 1 + input.marginPercent / 100;
  const wallsMap = new Map<string, WallInput>();
  input.walls.forEach((w) => wallsMap.set(w.id, w));

  // 1. Ścianki szklane
  for (const wall of input.walls) {
    const qty = Math.max(1, wall.quantity || 1);
    const std = getStandardProfile(wall.widthCm);

    if (!std) {
      result.walls.push({
        id: wall.id,
        type: wall.type,
        quantity: qty,
        widthCm: wall.widthCm,
        heightCm: wall.heightCm,
        areaSqm: 0,
        glassCostNet: 0,
        profileCostNet: 0,
        unitCostNet: 0,
        unitClientNet: 0,
        unitInstallCostNet: 0,
        unitInstallClientNet: 0,
        totalCostNet: 0,
        totalClientNet: 0,
        error: `Szerokość ${wall.widthCm} cm przekracza limit systemu (max 578 cm). Proszę podzielić na mniejsze ścianki.`,
      });
      continue;
    }

    const area = (wall.widthCm / 100) * (wall.heightCm / 100);
    const glassCostNet = area * input.glassPricePerSqm;
    const profileCost = std.baseFront;

    const unitCostNet = glassCostNet + profileCost;
    const unitClientNet = unitCostNet * marginMultiplier;

    const stdWidthMeters = std.width / 100;
    const unitInstallCostNet =
      wall.type === "FRONT"
        ? stdWidthMeters * input.installFrontCost
        : stdWidthMeters * input.installSideCost;
    const unitInstallClientNet =
      wall.type === "FRONT"
        ? stdWidthMeters * input.installFrontClient
        : stdWidthMeters * input.installSideClient;

    const totalCostNet = (unitCostNet + unitInstallCostNet) * qty;
    const totalClientNet = (unitClientNet + unitInstallClientNet) * qty;

    result.walls.push({
      id: wall.id,
      type: wall.type,
      quantity: qty,
      widthCm: wall.widthCm,
      heightCm: wall.heightCm,
      standardWidthCm: std.width,
      areaSqm: area,
      glassCostNet,
      profileCostNet: profileCost,
      unitCostNet,
      unitClientNet,
      unitInstallCostNet,
      unitInstallClientNet,
      totalCostNet,
      totalClientNet,
    });
  }

  // 2. Dodatki i Lamele z obsługą powiązania ze ścianami
  for (const acc of input.accessories) {
    const qty = Math.max(1, acc.quantity || 1);
    const linkedWall = acc.linkedWallId ? wallsMap.get(acc.linkedWallId) : undefined;
    const effectiveWidth = linkedWall ? linkedWall.widthCm : (acc.widthCm || 290);
    const linkedWallLabel = linkedWall
      ? `${linkedWall.type === "FRONT" ? "Ścianka frontowa" : "Ścianka boczna"} (${linkedWall.widthCm} cm)`
      : undefined;

    let unitCostNet = 0;
    let unitInstallCostNet = 0;
    let unitInstallClientNet = 0;
    let name = "";

    switch (acc.type) {
      case "LAMELLA_FRONT":
      case "LAMELLA_SIDE": {
        name = acc.type === "LAMELLA_FRONT" ? "Lamela frontowa" : "Lamela boczna kpl";
        unitCostNet = acc.priceNetCost !== undefined ? acc.priceNetCost : 850;
        unitInstallCostNet = acc.installNetCost || 0;
        unitInstallClientNet = acc.installNetClient || 0;
        break;
      }
      case "ADDON_TRIANGLE": {
        name = "Dodatek - trójkąt (poliwęglan)";
        const std = getStandardProfile(effectiveWidth);
        unitCostNet = acc.priceNetCost !== undefined ? acc.priceNetCost : (std?.triangle ?? 854);
        const meters = (std?.width ?? effectiveWidth) / 100;
        unitInstallCostNet =
          acc.installNetCost !== undefined ? acc.installNetCost : meters * input.installTriangleCostPerMb;
        unitInstallClientNet =
          acc.installNetClient !== undefined ? acc.installNetClient : meters * input.installTriangleClientPerMb;
        break;
      }
      case "ADDON_FOUNDATION": {
        name = "Dodatek - fundament";
        const std = getStandardProfile(effectiveWidth);
        unitCostNet = acc.priceNetCost !== undefined ? acc.priceNetCost : (std?.foundation ?? 179);
        const meters = (std?.width ?? effectiveWidth) / 100;
        unitInstallCostNet =
          acc.installNetCost !== undefined ? acc.installNetCost : meters * input.installFoundationCostPerMb;
        unitInstallClientNet =
          acc.installNetClient !== undefined ? acc.installNetClient : meters * input.installFoundationClientPerMb;
        break;
      }
      case "ADDON_PROFILE": {
        name = acc.customDescription?.trim() ? `Dodatek - profil (${acc.customDescription})` : "Dodatek - profil";
        unitCostNet = acc.priceNetCost !== undefined ? acc.priceNetCost : 500;
        unitInstallCostNet = acc.installNetCost || 0;
        unitInstallClientNet = acc.installNetClient || 0;
        break;
      }
      case "ADDON_OTHER": {
        name = acc.customDescription?.trim() ? `Dodatek - inne (${acc.customDescription})` : "Dodatek - inne";
        unitCostNet = acc.priceNetCost || 0;
        unitInstallCostNet = acc.installNetCost || 0;
        unitInstallClientNet = acc.installNetClient || 0;
        break;
      }
    }

    const unitClientNet = unitCostNet * marginMultiplier;
    const totalCostNet = (unitCostNet + unitInstallCostNet) * qty;
    const totalClientNet = (unitClientNet + unitInstallClientNet) * qty;

    result.accessories.push({
      id: acc.id,
      type: acc.type,
      name,
      linkedWallId: acc.linkedWallId,
      linkedWallLabel,
      quantity: qty,
      effectiveWidthCm: effectiveWidth,
      heightCm: acc.heightCm,
      unitCostNet,
      unitClientNet,
      unitInstallCostNet,
      unitInstallClientNet,
      totalCostNet,
      totalClientNet,
    });
  }

  // 3. Sumowanie
  for (const item of result.walls) {
    if (item.error) continue;
    result.materialsCostNet += item.unitCostNet * item.quantity;
    result.materialsClientNet += item.unitClientNet * item.quantity;
    result.installationCostNet += item.unitInstallCostNet * item.quantity;
    result.installationClientNet += item.unitInstallClientNet * item.quantity;
  }

  for (const acc of result.accessories) {
    result.materialsCostNet += acc.unitCostNet * acc.quantity;
    result.materialsClientNet += acc.unitClientNet * acc.quantity;
    result.installationCostNet += acc.unitInstallCostNet * acc.quantity;
    result.installationClientNet += acc.unitInstallClientNet * acc.quantity;
  }

  result.totalCostNet = result.materialsCostNet + result.installationCostNet;
  result.totalClientNet = result.materialsClientNet + result.installationClientNet;
  result.totalProfitZ = result.totalClientNet - result.totalCostNet;

  return result;
}
