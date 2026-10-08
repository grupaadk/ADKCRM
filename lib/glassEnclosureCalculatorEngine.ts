export type WallType = "FRONT" | "SIDE" | "LAMELLA" | "CUSTOM";

export interface WallInput {
  id: string;
  type: WallType;
  widthCm: number;
  heightCm: number;
  hasTriangle: boolean;
  hasFoundation: boolean;
  customDescription?: string;
  customPriceNet?: number;
  customInstallNet?: number;
  isExpanded?: boolean;
}

export interface EnclosureInput {
  walls: WallInput[];
  marginPercent: number;
  glassPricePerSqm: number;
  installFrontCost: number;
  installFrontClient: number;
  installSideCost: number;
  installSideClient: number;
}

export interface WallResult {
  id: string;
  type: WallType;
  widthCm: number;
  heightCm: number;
  standardWidthCm?: number;
  areaSqm: number;
  glassCostNet: number;
  profileCostNet: number;
  wallCostNet: number;
  wallClientNet: number;
  installCostNet: number;
  installClientNet: number;
  totalClientNet: number;
  error?: string;
}

export interface EnclosureResult {
  items: WallResult[];
  materialsCostNet: number;
  materialsClientNet: number;
  installationCostNet: number;
  installationClientNet: number;
  totalCostNet: number;
  totalClientNet: number;
  totalProfitZ: number;
}

// Baza profili standardowych co ~50cm (zgodnie z "NIESTANDARD bez szkła")
const PROFILES = [
  { width: 94, baseFront: 1155, triangle: 854, foundation: 106 },
  { width: 194, baseFront: 1155, triangle: 854, foundation: 106 },
  { width: 241, baseFront: 1650, triangle: 854, foundation: 179 },
  { width: 290, baseFront: 1650, triangle: 854, foundation: 179 },
  { width: 337, baseFront: 2285, triangle: 1016, foundation: 272 },
  { width: 386, baseFront: 2285, triangle: 1179, foundation: 272 },
  { width: 433, baseFront: 3072, triangle: 1463, foundation: 382 },
  { width: 482, baseFront: 3072, triangle: 1707, foundation: 382 },
  { width: 529, baseFront: 4017, triangle: 2439, foundation: 618 },
  { width: 578, baseFront: 4017, triangle: 2683, foundation: 618 },
];

function getStandardProfile(widthCm: number) {
  for (const p of PROFILES) {
    if (widthCm <= p.width) return p;
  }
  return null;
}

export function calculateGlassEnclosure(input: EnclosureInput): EnclosureResult {
  const result: EnclosureResult = {
    items: [],
    materialsCostNet: 0,
    materialsClientNet: 0,
    installationCostNet: 0,
    installationClientNet: 0,
    totalCostNet: 0,
    totalClientNet: 0,
    totalProfitZ: 0,
  };

  for (const wall of input.walls) {
    if (wall.type === "LAMELLA" || wall.type === "CUSTOM") {
      const price = wall.customPriceNet || 0;
      const install = wall.customInstallNet || 0;
      const clientPrice = price * (1 + input.marginPercent / 100);
      result.items.push({
        id: wall.id,
        type: wall.type,
        widthCm: wall.widthCm,
        heightCm: wall.heightCm,
        areaSqm: 0,
        glassCostNet: 0,
        profileCostNet: price,
        wallCostNet: price,
        wallClientNet: clientPrice,
        installCostNet: install,
        installClientNet: install,
        totalClientNet: clientPrice + install,
      });
      continue;
    }

    const std = getStandardProfile(wall.widthCm);
    if (!std) {
      result.items.push({
        id: wall.id,
        type: wall.type,
        widthCm: wall.widthCm,
        heightCm: wall.heightCm,
        areaSqm: 0,
        glassCostNet: 0,
        profileCostNet: 0,
        wallCostNet: 0,
        wallClientNet: 0,
        installCostNet: 0,
        installClientNet: 0,
        totalClientNet: 0,
        error: `Szerokość ${wall.widthCm} cm przekracza limit systemu (max 578 cm). Proszę podzielić na mniejsze ścianki.`,
      });
      continue;
    }

    const area = (wall.widthCm / 100) * (wall.heightCm / 100);
    const glassCost = area * input.glassPricePerSqm;
    
    let profileCost = std.baseFront;
    if (wall.type === "SIDE") {
      if (wall.hasTriangle) profileCost += std.triangle;
      if (wall.hasFoundation) profileCost += std.foundation;
    }

    const wallCostNet = glassCost + profileCost;
    const wallClientNet = wallCostNet * (1 + input.marginPercent / 100);

    const stdWidthMeters = std.width / 100;
    let installCost = 0;
    let installClient = 0;

    if (wall.type === "FRONT") {
      installCost = stdWidthMeters * input.installFrontCost;
      installClient = stdWidthMeters * input.installFrontClient;
    } else {
      installCost = stdWidthMeters * input.installSideCost;
      installClient = stdWidthMeters * input.installSideClient;
    }

    result.items.push({
      id: wall.id,
      type: wall.type,
      widthCm: wall.widthCm,
      heightCm: wall.heightCm,
      standardWidthCm: std.width,
      areaSqm: area,
      glassCostNet: glassCost,
      profileCostNet: profileCost,
      wallCostNet: wallCostNet,
      wallClientNet: wallClientNet,
      installCostNet: installCost,
      installClientNet: installClient,
      totalClientNet: wallClientNet + installClient,
    });
  }

  for (const item of result.items) {
    if (item.error) continue;
    result.materialsCostNet += item.wallCostNet;
    result.materialsClientNet += item.wallClientNet;
    result.installationCostNet += item.installCostNet;
    result.installationClientNet += item.installClientNet;
  }

  result.totalCostNet = result.materialsCostNet + result.installationCostNet;
  result.totalClientNet = result.materialsClientNet + result.installationClientNet;
  result.totalProfitZ = result.totalClientNet - result.totalCostNet;

  return result;
}
