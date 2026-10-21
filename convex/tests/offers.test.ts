import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

describe("CAD Offers and Constructions Module", () => {
  test("creates offer for sales opportunity and recalculates totals", async () => {
    const t = convexTest(schema);

    // 1. Create a sample opportunity
    const oppId = await t.run(async (ctx) => {
      return await ctx.db.insert("pendingJotformSubmissions", {
        submissionId: "SUB-101",
        firstName: "Jan",
        lastName: "Kowalski",
        email: "jan.kowalski@example.pl",
        phone: "+48 600 700 800",
        city: "Warszawa",
        processed: false,
        stage: "lead",
      });
    });

    // 2. Get or create offer for this opportunity
    const offerId = await t.mutation(api.offers.getOrCreateForOpportunity, {
      opportunityId: oppId,
    });
    expect(offerId).toBeDefined();

    // 3. Add first construction position (System całoszklany 3-torowy)
    const pos1Id = await t.mutation(api.offers.addConstructionPosition, {
      offerId,
      name: "System całoszklany 3-torowy",
      widthMm: 2880,
      heightMm: 2300,
      panesCount: 3,
      priceNet: 12500,
      costNet: 8000,
    });
    expect(pos1Id).toBeDefined();

    // 4. Verify offer query returns the position and correct totals
    let data = await t.query(api.offers.getOfferWithItems, { offerId });
    expect(data).not.toBeNull();
    expect(data!.items.length).toBe(1);
    expect(data!.offer.totalPriceNet).toBe(12500);
    expect(data!.offer.totalCostNet).toBe(8000);
    expect(data!.offer.totalPriceGross).toBe(Math.round(12500 * 1.23));

    // 5. Add second construction position
    const pos2Id = await t.mutation(api.offers.addConstructionPosition, {
      offerId,
      name: "System całoszklany 4-torowy",
      widthMm: 3800,
      heightMm: 2300,
      panesCount: 4,
      priceNet: 16000,
      costNet: 10500,
    });
    expect(pos2Id).toBeDefined();

    // 6. Verify totals after 2 positions
    data = await t.query(api.offers.getOfferWithItems, { offerId });
    expect(data!.items.length).toBe(2);
    expect(data!.offer.totalPriceNet).toBe(28500);
    expect(data!.offer.totalCostNet).toBe(18500);

    // 7. Test discount application
    await t.mutation(api.offers.updateOffer, {
      offerId,
      discountPercent: 10,
    });

    data = await t.query(api.offers.getOfferWithItems, { offerId });
    const expectedDiscounted = Math.round(28500 * 0.9);
    expect(data!.offer.totalPriceNet).toBe(expectedDiscounted);

    // 8. Test position duplication
    const dupId = await t.mutation(api.offers.duplicateConstructionPosition, {
      itemId: pos1Id,
    });
    expect(dupId).toBeDefined();

    data = await t.query(api.offers.getOfferWithItems, { offerId });
    expect(data!.items.length).toBe(3);

    // 9. Test position deletion
    await t.mutation(api.offers.removeConstructionPosition, {
      itemId: dupId,
    });

    data = await t.query(api.offers.getOfferWithItems, { offerId });
    expect(data!.items.length).toBe(2);
  });

  test("manages construction templates in settings catalog", async () => {
    const t = convexTest(schema);

    // Seed defaults
    const seedResult = await t.mutation(api.constructions.seedDefault, {});
    expect(seedResult.created).toBe(4);

    // List templates
    const list = await t.query(api.constructions.list, {});
    expect(list.length).toBe(4);
    expect(list[0].code).toBe("SZKLO-3T");
    const triangleTemplate = list.find((c) => c.code === "TROJKAT-TARAS");
    expect(triangleTemplate).toBeDefined();
    expect(triangleTemplate?.name).toBe("Trójkąt do zabudowy tarasu");
    expect(triangleTemplate?.defaultSystem).toBe("Profil H + Krokiew");

    // Create custom construction template
    const newId = await t.mutation(api.constructions.create, {
      name: "Pergola aluminiowa bioklimatyczna",
      code: "PERG-BIO",
      category: "Zadaszenia",
      defaultWidthMm: 4000,
      defaultHeightMm: 2800,
      defaultPanesCount: 4,
      defaultSystem: "ALUPROF MB-OPENSKY",
    });
    expect(newId).toBeDefined();

    const updatedList = await t.query(api.constructions.list, {});
    expect(updatedList.length).toBe(5);

    // Update description then clear it
    await t.mutation(api.constructions.update, {
      id: newId,
      description: "Opis testowy",
    });
    let item = await t.query(api.constructions.get, { id: newId });
    expect(item?.description).toBe("Opis testowy");

    await t.mutation(api.constructions.update, {
      id: newId,
      description: "",
    });
    item = await t.query(api.constructions.get, { id: newId });
    expect(item?.description).toBeUndefined();
  });

  test("manages construction categories dictionary and links them to constructions", async () => {
    const t = convexTest(schema);

    // 1. Seed default categories
    const seedResult = await t.mutation(api.constructionCategories.seedDefault, {});
    expect(seedResult.created).toBe(5);

    // 2. List categories
    const categories = await t.query(api.constructionCategories.list, {});
    expect(categories.length).toBe(5);
    const glassCat = categories.find((c) => c.code === "SZKLO")!;
    expect(glassCat).toBeDefined();
    expect(glassCat.name).toBe("Systemy szklane");
    const triangleCat = categories.find((c) => c.code === "TROJKAT")!;
    expect(triangleCat).toBeDefined();
    expect(triangleCat.name).toBe("Trójkąt");

    // 3. Create a new category
    const catId = await t.mutation(api.constructionCategories.create, {
      name: "Ogrody zimowe",
      code: "OGROD",
      description: "Ciepłe zabudowy ogrodów zimowych ze szkłem zespolonym",
      color: "purple",
    });
    expect(catId).toBeDefined();

    // 4. Create construction linked to categoryId
    const constId = await t.mutation(api.constructions.create, {
      name: "Ogród zimowy aluminiowy",
      code: "OGROD-ALU",
      categoryId: catId,
      defaultWidthMm: 5000,
      defaultHeightMm: 2600,
      defaultPanesCount: 5,
    });
    expect(constId).toBeDefined();

    const createdConst = await t.query(api.constructions.get, { id: constId });
    expect(createdConst?.categoryId).toBe(catId);
    expect(createdConst?.category).toBe("Ogrody zimowe");

    // 5. Update category name and verify propagation
    await t.mutation(api.constructionCategories.update, {
      id: catId,
      name: "Ogrody zimowe i oranżerie",
    });

    const updatedConst = await t.query(api.constructions.get, { id: constId });
    expect(updatedConst?.category).toBe("Ogrody zimowe i oranżerie");

    // 6. Remove category and verify unlinking
    await t.mutation(api.constructionCategories.remove, { id: catId });
    const unlinkedConst = await t.query(api.constructions.get, { id: constId });
    expect(unlinkedConst?.categoryId).toBeUndefined();

    const finalCategories = await t.query(api.constructionCategories.list, {});
    expect(finalCategories.length).toBe(5);

    // 7. Test ensureTriangleConstruction mutation idempotency
    const ensureResult = await t.mutation(api.constructions.ensureTriangleConstruction, {});
    expect(ensureResult).toBeDefined();
  });

  test("manages spatial CAD placement (placedAboveItemId, rowIndex)", async () => {
    const t = convexTest(schema);

    // 1. Create opportunity and offer
    const oppId = await t.run(async (ctx) => {
      return await ctx.db.insert("pendingJotformSubmissions", {
        submissionId: "SUB-CAD-1",
        firstName: "Tomasz",
        lastName: "Nowak",
        email: "tomasz@example.pl",
        phone: "+48 500 600 700",
        processed: false,
        stage: "lead",
      });
    });

    const offerId = await t.mutation(api.offers.getOrCreateForOpportunity, {
      opportunityId: oppId,
    });

    // 2. Add base wall sliding door (Row 0, floor level)
    const baseDoorId = await t.mutation(api.offers.addConstructionPosition, {
      offerId,
      name: "Ściana przesuwna 3-torowa",
      widthMm: 2880,
      heightMm: 2300,
      panesCount: 3,
    });

    // 3. Add gable triangle intended to sit on top of the door
    const triangleId = await t.mutation(api.offers.addConstructionPosition, {
      offerId,
      name: "Trójkąt do zabudowy tarasu",
      widthMm: 2880,
      heightMm: 1000,
    });

    // 4. Update triangle placement to sit ABOVE baseDoor
    await t.mutation(api.offers.updateConstructionPosition, {
      itemId: triangleId,
      placedAboveItemId: baseDoorId,
      rowIndex: 0,
    });

    let offerData = await t.query(api.offers.getOfferWithItems, { offerId });
    let triangleItem = offerData!.items.find((it) => it._id === triangleId);
    expect(triangleItem?.placedAboveItemId).toBe(baseDoorId);
    expect(triangleItem?.rowIndex).toBe(0);

    // 5. Move a construction to row 1 (kolejny rząd poniżej)
    await t.mutation(api.offers.updateConstructionPosition, {
      itemId: triangleId,
      placedAboveItemId: null,
      rowIndex: 1,
    });

    offerData = await t.query(api.offers.getOfferWithItems, { offerId });
    triangleItem = offerData!.items.find((it) => it._id === triangleId);
    expect(triangleItem?.placedAboveItemId).toBeUndefined();
    expect(triangleItem?.rowIndex).toBe(1);

    // 6. Reset back to floor level (Row 0, no parent)
    await t.mutation(api.offers.updateConstructionPosition, {
      itemId: triangleId,
      placedAboveItemId: null,
      rowIndex: null,
    });

    offerData = await t.query(api.offers.getOfferWithItems, { offerId });
    triangleItem = offerData!.items.find((it) => it._id === triangleId);
    expect(triangleItem?.placedAboveItemId).toBeUndefined();
    expect(triangleItem?.rowIndex).toBeUndefined();
  });
});
