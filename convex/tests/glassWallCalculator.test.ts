import { expect, test, describe } from "vitest";
import {
  calculateGlassWallItem,
  calculateGlassSegments,
  findMatchingThreshold,
  determineGlassWallType,
} from "../lib/glassWallCalculator";

describe("Glass Wall & Triangle Calculator Engine (Excel verification)", () => {
  test("reproduces the exact calculation from Excel for 'Ścianka frontowa 1' (4 pcs, 433x249 cm, NIESTANDARD)", () => {
    // Dane wejściowe z wiersza 1 arkusza Excel
    const result = calculateGlassWallItem({
      wallType: "front",
      widthMm: 4330,
      heightMm: 2490,
      quantity: 4,
      variant: "nonstandard",
      includeAssembly: true,
    });

    // 1. Wymiary i powierzchnia
    expect(result.widthMm).toBe(4330);
    expect(result.heightMm).toBe(2490);
    expect(result.areaM2).toBeCloseTo(10.7817, 3);
    expect(result.matchedThresholdCm).toBe(433);
    expect(result.tracks).toBe(5);

    // 2. Koszty zakupu netto (1 szt.)
    // W Excelu: Cena szkła = 2425.8825 zł, System bez szkła = 3072 zł
    expect(result.glassCost).toBeCloseTo(2425.88, 1);
    expect(result.profilesCost + result.accessoriesCost).toBeCloseTo(3072, 1);
    // Łączny koszt konstrukcji w Excelu = 5497.8825 zł
    expect(result.constructionCostNet).toBeCloseTo(5497.88, 1);

    // 3. Cena z narzutem 52% (1 szt.)
    // W Excelu = 8356.7814 zł
    expect(result.constructionPriceNet).toBeCloseTo(8356.78, 1);

    // 4. Montaż (1 szt.)
    // W Excelu: koszt = 1082.5 zł, klient = 1299 zł
    expect(result.assemblyCostNet).toBeCloseTo(1082.5, 1);
    expect(result.assemblyPriceNet).toBeCloseTo(1299.0, 1);

    // 5. Razem 1 sztuka
    // W Excelu: koszt = 6580.3825 zł, cena klient = 9655.7814 zł
    expect(result.unitTotalCostNet).toBeCloseTo(6580.38, 1);
    expect(result.unitTotalPriceNet).toBeCloseTo(9655.78, 1);

    // 6. SUMA dla 4 sztuk
    // W Excelu: SUMA koszt = 26321.53 zł, SUMA klient = 38623.1256 zł
    expect(result.totalCostNet).toBeCloseTo(26321.53, 1);
    expect(result.totalPriceNet).toBeCloseTo(38623.13, 1);
    // Zysk i marża
    expect(result.totalProfitNet).toBeCloseTo(12301.6, 0);
  });

  test("calculates CAD glass dimensions with Z=30mm overlap matching Excel example (3410x2335 mm)", () => {
    // Przykład z dolnej sekcji Excela: otwór 3410 mm, H=2335 mm, 4 tafle, Z=30 mm
    const seg = calculateGlassSegments(3410, 2335, 4, 30);

    // W Excelu: Szerokość do zamówienia = 875 mm
    // Wzór: (3410 + (4 - 1) * 30) / 4 = (3410 + 90) / 4 = 3500 / 4 = 875
    expect(seg.glassWidthMm).toBe(875);

    // W Excelu: Wysokość do zamówienia = 2235 mm (2335 - 100 mm)
    expect(seg.glassHeightMm).toBe(2235);
    expect(seg.panesCount).toBe(4);
    expect(seg.segments).toHaveLength(4);
  });

  test("correctly calculates standard front and side walls (including triangle and foundation thresholds)", () => {
    const t433 = findMatchingThreshold(433);
    expect(t433.standardFrontTotalCost).toBe(4536); // 4244 + 154 + 138
    expect(t433.standardSideTotalCost).toBe(6381);  // 4536 + 1463 (trójkąt) + 382 (fundament)
    expect(t433.triangleCost).toBe(1463);
    expect(t433.foundationCost).toBe(382);

    const calcStdFront = calculateGlassWallItem({
      wallType: "front",
      widthMm: 4330,
      heightMm: 2300,
      variant: "standard",
      includeAssembly: false,
    });
    expect(calcStdFront.constructionCostNet).toBe(4536);
    expect(calcStdFront.constructionPriceNet).toBeCloseTo(4536 * 1.52, 1);

    const calcStdSide = calculateGlassWallItem({
      wallType: "side",
      widthMm: 4330,
      heightMm: 2300,
      variant: "standard",
      includeAssembly: false,
    });
    expect(calcStdSide.constructionCostNet).toBe(6381);
    expect(calcStdSide.constructionPriceNet).toBeCloseTo(6381 * 1.52, 1);
  });

  test("correctly calculates triangle only position with assembly", () => {
    const triangle = calculateGlassWallItem({
      wallType: "triangle",
      widthMm: 3370,
      heightMm: 600,
      quantity: 1,
      includeAssembly: true,
    });

    // Próg 337 cm: trójkąt koszt = 1016 zł
    expect(triangle.triangleCost).toBe(1016);
    expect(triangle.constructionCostNet).toBe(1016);
    expect(triangle.constructionPriceNet).toBeCloseTo(1016 * 1.52, 1);
    // Montaż trójkąta: 3.37 mb * 200 zł/mb koszt = 674 zł; klient = 3.37 * 250 = 842.50 zł
    expect(triangle.assemblyCostNet).toBeCloseTo(674, 1);
    expect(triangle.assemblyPriceNet).toBeCloseTo(842.5, 1);
  });

  describe("determineGlassWallType (Excel STANDARD vs NIESTANDARD classification)", () => {
    test("classifies exact standard dimensions as STANDARD", () => {
      // Standard widths [940, 1940, 2410, 2900, 3370, 3860, 4330, 4820, 5290, 5780] and heights [2200, 2250, 2300]
      expect(determineGlassWallType(940, 2300)).toBe("STANDARD");
      expect(determineGlassWallType(1940, 2300)).toBe("STANDARD");
      expect(determineGlassWallType(2410, 2250)).toBe("STANDARD");
      expect(determineGlassWallType(2900, 2200)).toBe("STANDARD");
      expect(determineGlassWallType(3370, 2300)).toBe("STANDARD");
      expect(determineGlassWallType(3860, 2300)).toBe("STANDARD");
      expect(determineGlassWallType(4330, 2300)).toBe("STANDARD");
      expect(determineGlassWallType(4820, 2300)).toBe("STANDARD");
      expect(determineGlassWallType(5290, 2300)).toBe("STANDARD");
      expect(determineGlassWallType(5780, 2300)).toBe("STANDARD");
    });

    test("tolerates +/- 5mm variance for standard threshold dimensions", () => {
      expect(determineGlassWallType(4332, 2300)).toBe("STANDARD");
      expect(determineGlassWallType(4328, 2300)).toBe("STANDARD");
      expect(determineGlassWallType(1940, 2298)).toBe("STANDARD");
    });

    test("classifies height > 2300mm as NIESTANDARD (e.g. Row 1 from Excel at 2490mm)", () => {
      expect(determineGlassWallType(4330, 2490)).toBe("NIESTANDARD");
      expect(determineGlassWallType(1940, 2350)).toBe("NIESTANDARD");
      expect(determineGlassWallType(2410, 2500)).toBe("NIESTANDARD");
    });

    test("classifies custom non-standard width as NIESTANDARD", () => {
      expect(determineGlassWallType(2000, 2300)).toBe("NIESTANDARD");
      expect(determineGlassWallType(3000, 2300)).toBe("NIESTANDARD");
      expect(determineGlassWallType(4000, 2300)).toBe("NIESTANDARD");
      expect(determineGlassWallType(5000, 2300)).toBe("NIESTANDARD");
    });

    test("classifies non-standard height as NIESTANDARD", () => {
      expect(determineGlassWallType(4330, 2100)).toBe("NIESTANDARD");
      expect(determineGlassWallType(1940, 2220)).toBe("NIESTANDARD");
    });
  });
});
