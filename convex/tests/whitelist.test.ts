import { describe, expect, test } from "vitest";
import { parsePolishAddress } from "../whitelist";

describe("parsePolishAddress", () => {
  test("parses standard street with building number and postal code", () => {
    const res = parsePolishAddress("UL. PROSTA 51, 00-838 WARSZAWA");
    expect(res).toEqual({
      street: "PROSTA",
      buildingNumber: "51",
      apartmentNumber: undefined,
      postalCode: "00-838",
      city: "WARSZAWA",
    });
  });

  test("parses addresses with spaces around slash (MF standard format)", () => {
    const res = parsePolishAddress("UL. ZŁOTA 44 / 33, 00-120 WARSZAWA");
    expect(res).toEqual({
      street: "ZŁOTA",
      buildingNumber: "44",
      apartmentNumber: "33",
      postalCode: "00-120",
      city: "WARSZAWA",
    });
  });

  test("parses addresses with lok. / m. and letters", () => {
    const res1 = parsePolishAddress("UL. MARSZAŁKOWSKA 10 M. 5, 00-001 WARSZAWA");
    expect(res1).toEqual({
      street: "MARSZAŁKOWSKA",
      buildingNumber: "10",
      apartmentNumber: "5",
      postalCode: "00-001",
      city: "WARSZAWA",
    });

    const res2 = parsePolishAddress("UL. POSTĘPU 14 LOK. 2A, 02-676 WARSZAWA");
    expect(res2).toEqual({
      street: "POSTĘPU",
      buildingNumber: "14",
      apartmentNumber: "2A",
      postalCode: "02-676",
      city: "WARSZAWA",
    });

    const res3 = parsePolishAddress("UL. DOMANIEWSKA 39A, LOK. 4, 02-672 WARSZAWA");
    expect(res3).toEqual({
      street: "DOMANIEWSKA",
      buildingNumber: "39A",
      apartmentNumber: "4",
      postalCode: "02-672",
      city: "WARSZAWA",
    });
  });

  test("parses building ranges with separate apartment", () => {
    const res = parsePolishAddress("UL. ŚWIĘTOKRZYSKA 12/14 LOK. 5B, 00-001 WARSZAWA");
    expect(res).toEqual({
      street: "ŚWIĘTOKRZYSKA",
      buildingNumber: "12/14",
      apartmentNumber: "5B",
      postalCode: "00-001",
      city: "WARSZAWA",
    });
  });

  test("handles villages without street names (town and street identical)", () => {
    const res = parsePolishAddress("KOZIEGŁOWY 12A, 62-028 KOZIEGŁOWY");
    expect(res).toEqual({
      street: "",
      buildingNumber: "12A",
      apartmentNumber: undefined,
      postalCode: "62-028",
      city: "KOZIEGŁOWY",
    });
  });

  test("handles trailing country (Polska)", () => {
    const res = parsePolishAddress("UL. PROSTA 51, 00-838 WARSZAWA, POLSKA");
    expect(res).toEqual({
      street: "PROSTA",
      buildingNumber: "51",
      apartmentNumber: undefined,
      postalCode: "00-838",
      city: "WARSZAWA",
    });
  });

  test("handles various street prefixes (al., pl., os.)", () => {
    const res1 = parsePolishAddress("AL. JEROZOLIMSKIE 142B, 02-305 WARSZAWA");
    expect(res1.street).toBe("JEROZOLIMSKIE");
    expect(res1.buildingNumber).toBe("142B");

    const res2 = parsePolishAddress("PL. DEFA 1, 00-901 WARSZAWA");
    expect(res2.street).toBe("DEFA");
    expect(res2.buildingNumber).toBe("1");
  });

  test("gracefully falls back when postal code is missing", () => {
    const res = parsePolishAddress("NOWY ŚWIAT 15 WARSZAWA");
    expect(res).toEqual({
      street: "NOWY ŚWIAT 15 WARSZAWA",
      buildingNumber: "",
      apartmentNumber: undefined,
      postalCode: "",
      city: "",
    });
  });
});
