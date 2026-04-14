import { expect, test, describe } from "vitest";
import { mapJotformPayload, splitStreetAndBuilding } from "../jotform";

describe("mapJotformPayload — adres Jotform", () => {
  test("czyta kod pocztowy z postal (EU), nie tylko zip", () => {
    const mapped = mapJotformPayload({
      q8_imieI: { first: "Jan", last: "Kowalski" },
      q39_adres: {
        addr_line1: "ul. Lipowa 12",
        addr_line2: "5",
        city: "Kraków",
        postal: "30-042",
      },
    });
    expect(mapped.postalCode).toBe("30-042");
    expect(mapped.street).toBe("ul. Lipowa");
    expect(mapped.buildingNumber).toBe("12");
    expect(mapped.apartmentNumber).toBe("5");
  });

  test("normalizuje kod z samych cyfr do formatu PL", () => {
    const mapped = mapJotformPayload({
      q8_imieI: { first: "Jan", last: "K" },
      q39_adres: {
        addr_line1: "Test",
        city: "Wawa",
        zip: "30042",
      },
    });
    expect(mapped.postalCode).toBe("30-042");
  });

  test("płaskie klucze q39_adres[postal]", () => {
    const mapped = mapJotformPayload({
      q8_imieI: { first: "Jan", last: "K" },
      "q39_adres[addr_line1]": "Foo 1",
      "q39_adres[city]": "Gdańsk",
      "q39_adres[postal]": "80-001",
    });
    expect(mapped.postalCode).toBe("80-001");
    expect(mapped.street).toBe("Foo");
    expect(mapped.buildingNumber).toBe("1");
  });
});

describe("splitStreetAndBuilding", () => {
  test("bez numeru — całość zostaje jako ulica", () => {
    expect(splitStreetAndBuilding("Parkowa")).toEqual({
      street: "Parkowa",
      buildingNumber: undefined,
    });
  });

  test("numer na końcu", () => {
    expect(splitStreetAndBuilding("ul. Marszałkowska 15")).toEqual({
      street: "ul. Marszałkowska",
      buildingNumber: "15",
    });
  });

  test("format 15/3 jako jeden numer budynku", () => {
    expect(splitStreetAndBuilding("Długa 15/3")).toEqual({
      street: "Długa",
      buildingNumber: "15/3",
    });
  });
});
