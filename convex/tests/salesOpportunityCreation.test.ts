import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

type TestRuntime = ReturnType<typeof convexTest>;

async function setupAuthContext(t: TestRuntime) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "admin@example.pl",
      displayName: "Admin User",
      role: "admin",
      isActive: true,
    });
  });
  return t.withIdentity({ subject: userId });
}

describe("Sales Opportunity Creation & Field Integrity", () => {
  test("creates manual opportunity with all form fields and verifies data integrity in getSalesOpportunity", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    const opportunityId = await asUser.mutation(api.salesOpportunities.createManualOpportunity, {
      firstName: "Jan",
      lastName: "Kowalski",
      email: "jan.kowalski@example.com",
      phone: "+48 500 123 456",
      street: "ul. Marszałkowska",
      buildingNumber: "10",
      apartmentNumber: "4",
      postalCode: "00-001",
      city: "Warszawa",
      investmentStreet: "ul. Działkowa",
      investmentBuildingNumber: "25",
      investmentApartmentNumber: "1",
      investmentPostalCode: "05-500",
      investmentCity: "Piaseczno",
      services: ["Zadaszenie tarasu", "System przeciwsłoneczny - rolety"],
      customText: "Wycena zadaszenia 6x4m z roletami",
      leadSource: "Strona WWW (Formularz)",
      comment: "Klient prosi o kontakt po 16:00. Montaż planowany na maj.",
    });

    const opp = await t.query(api.salesOpportunities.getSalesOpportunity, { opportunityId });

    expect(opp).not.toBeNull();
    expect(opp?.firstName).toBe("Jan");
    expect(opp?.lastName).toBe("Kowalski");
    expect(opp?.email).toBe("jan.kowalski@example.com");
    expect(opp?.phone).toBe("500-123-456");

    // Adres klienta
    expect(opp?.street).toBe("ul. Marszałkowska");
    expect(opp?.buildingNumber).toBe("10");
    expect(opp?.apartmentNumber).toBe("4");
    expect(opp?.postalCode).toBe("00-001");
    expect(opp?.city).toBe("Warszawa");

    // Adres inwestycji
    expect(opp?.investmentStreet).toBe("ul. Działkowa");
    expect(opp?.investmentBuildingNumber).toBe("25");
    expect(opp?.investmentApartmentNumber).toBe("1");
    expect(opp?.investmentPostalCode).toBe("05-500");
    expect(opp?.investmentCity).toBe("Piaseczno");

    // Usługi i szczegóły leada
    expect(opp?.services).toEqual(["Zadaszenie tarasu", "System przeciwsłoneczny - rolety"]);
    expect(opp?.customText).toBe("Wycena zadaszenia 6x4m z roletami");
    expect(opp?.leadSource).toBe("Strona WWW (Formularz)");
    expect(opp?.comment).toBe("Klient prosi o kontakt po 16:00. Montaż planowany na maj.");
    expect(opp?.stage).toBe("lead");
    expect(opp?.processed).toBe(false);
  });

  test("creates opportunity linked to existing client with 'same address as client' and autofills client details", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    // 1. Tworzymy klienta w bazie
    const clientId = await asUser.mutation(api.clients.create, {
      clientType: "individual",
      firstName: "Anna",
      lastName: "Nowak",
      email: "anna.nowak@example.pl",
      phone: "601 222 333",
      street: "ul. Kwiatowa",
      buildingNumber: "15A",
      apartmentNumber: "2",
      postalCode: "05-800",
      city: "Pruszków",
    });

    // 2. Tworzymy szansę sprzedaży powiązaną z tym klientem
    const opportunityId = await asUser.mutation(api.salesOpportunities.createManualOpportunity, {
      clientId,
      firstName: "Anna",
      lastName: "Nowak",
      email: "anna.nowak@example.pl",
      phone: "601 222 333",
      street: "ul. Kwiatowa",
      buildingNumber: "15A",
      apartmentNumber: "2",
      postalCode: "05-800",
      city: "Pruszków",
      investmentStreet: "ul. Kwiatowa",
      investmentBuildingNumber: "15A",
      investmentApartmentNumber: "2",
      investmentPostalCode: "05-800",
      investmentCity: "Pruszków",
      services: ["Pergola"],
      leadSource: "Rekomendacja / Polecenie",
    });

    const opp = await t.query(api.salesOpportunities.getSalesOpportunity, { opportunityId });

    expect(opp).not.toBeNull();
    expect(opp?.clientId).toBe(clientId);
    expect(opp?.firstName).toBe("Anna");
    expect(opp?.lastName).toBe("Nowak");
    expect(opp?.email).toBe("anna.nowak@example.pl");
    expect(opp?.phone).toBe("601-222-333");

    // Adres klienta
    expect(opp?.street).toBe("ul. Kwiatowa");
    expect(opp?.buildingNumber).toBe("15A");
    expect(opp?.apartmentNumber).toBe("2");
    expect(opp?.postalCode).toBe("05-800");
    expect(opp?.city).toBe("Pruszków");

    // Adres inwestycji identyczny jak klienta
    expect(opp?.investmentStreet).toBe("ul. Kwiatowa");
    expect(opp?.investmentBuildingNumber).toBe("15A");
    expect(opp?.investmentApartmentNumber).toBe("2");
    expect(opp?.investmentPostalCode).toBe("05-800");
    expect(opp?.investmentCity).toBe("Pruszków");
  });

  test("creates opportunity linked to business client with different investment address", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    // 1. Tworzymy klienta firmowego
    const clientId = await asUser.mutation(api.clients.create, {
      clientType: "business",
      companyName: "Bud-Max Sp. z o.o.",
      nip: "5250001122",
      firstName: "Marek",
      lastName: "Kierownik",
      email: "biuro@budmax.pl",
      phone: "512 999 888",
      street: "Al. Jerozolimskie",
      buildingNumber: "100",
      postalCode: "02-001",
      city: "Warszawa",
    });

    // 2. Inwestycja realizowana pod innym adresem (np. budowa w Piasecznie)
    const opportunityId = await asUser.mutation(api.salesOpportunities.createManualOpportunity, {
      clientId,
      firstName: "Marek",
      lastName: "Kierownik",
      email: "biuro@budmax.pl",
      phone: "512 999 888",
      street: "Al. Jerozolimskie",
      buildingNumber: "100",
      postalCode: "02-001",
      city: "Warszawa",
      investmentStreet: "ul. Inwestycyjna",
      investmentBuildingNumber: "7",
      investmentPostalCode: "05-500",
      investmentCity: "Piaseczno",
      services: ["Ściany szklane", "Konstrukcja aluminiowa"],
      customText: "BUD-MAX – Biurowiec Segment B",
      leadSource: "Targi / Wydarzenie",
    });

    const opp = await t.query(api.salesOpportunities.getSalesOpportunity, { opportunityId });

    expect(opp).not.toBeNull();
    expect(opp?.clientId).toBe(clientId);

    // Dane siedziby klienta
    expect(opp?.street).toBe("Al. Jerozolimskie");
    expect(opp?.buildingNumber).toBe("100");
    expect(opp?.city).toBe("Warszawa");

    // Adres montażu/inwestycji
    expect(opp?.investmentStreet).toBe("ul. Inwestycyjna");
    expect(opp?.investmentBuildingNumber).toBe("7");
    expect(opp?.investmentCity).toBe("Piaseczno");

    expect(opp?.services).toEqual(["Ściany szklane", "Konstrukcja aluminiowa"]);
    expect(opp?.customText).toBe("BUD-MAX – Biurowiec Segment B");
  });

  test("converts opportunity to order and preserves leadSource, and allows updating leadSource on order", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    const opportunityId = await asUser.mutation(api.salesOpportunities.createManualOpportunity, {
      firstName: "Piotr",
      lastName: "Zieliński",
      email: "piotr@zielinski.pl",
      phone: "505 111 222",
      street: "ul. Leśna",
      buildingNumber: "5",
      postalCode: "05-120",
      city: "Legionowo",
      services: ["Pergola rzymska"],
      leadSource: "Facebook Ads – Kampania Wiosna",
    });

    // Zmiana statusu na "inquiry" (Oferta wysłana), wymagana do konwersji
    await asUser.mutation(api.salesOpportunities.updateOpportunityStage, {
      opportunityId,
      stage: "inquiry",
    });

    // Konwersja do zlecenia
    const { orderId } = await asUser.mutation(api.salesOpportunities.convertToOrder, {
      opportunityId,
    });

    // Sprawdzamy czy zlecenie ma prawidłowo przypisane leadSource z szansy
    const order = await t.run(async (ctx) => {
      return await ctx.db.get(orderId);
    });

    expect(order).not.toBeNull();
    expect(order?.leadSource).toBe("Facebook Ads – Kampania Wiosna");
    expect(order?.services).toEqual(["Pergola rzymska"]);

    // Aktualizacja leadSource na zleceniu przez update
    await asUser.mutation(api.orders.update, {
      orderId,
      leadSource: "Polecenie od sąsiada",
    });

    const updatedOrder = await t.run(async (ctx) => {
      return await ctx.db.get(orderId);
    });
    expect(updatedOrder?.leadSource).toBe("Polecenie od sąsiada");
  });
});
