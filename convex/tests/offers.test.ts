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

    // 7b. Test VAT rate change (8%, 0%, 23%)
    await t.mutation(api.offers.updateOffer, {
      offerId,
      vatRate: 8,
    });
    data = await t.query(api.offers.getOfferWithItems, { offerId });
    expect(data!.offer.vatRate).toBe(8);
    expect(data!.offer.totalPriceGross).toBe(Math.round(expectedDiscounted * 1.08));

    await t.mutation(api.offers.updateOffer, {
      offerId,
      vatRate: 0,
    });
    data = await t.query(api.offers.getOfferWithItems, { offerId });
    expect(data!.offer.vatRate).toBe(0);
    expect(data!.offer.totalPriceGross).toBe(expectedDiscounted);

    await t.mutation(api.offers.updateOffer, {
      offerId,
      vatRate: 23,
    });
    data = await t.query(api.offers.getOfferWithItems, { offerId });
    expect(data!.offer.vatRate).toBe(23);
    expect(data!.offer.totalPriceGross).toBe(Math.round(expectedDiscounted * 1.23));

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

    // 10. Test recalculateOffer gracefully handles nonexistent opportunity document
    await t.run(async (ctx) => {
      await ctx.db.delete(oppId);
    });
    const pos3Id = await t.mutation(api.offers.addConstructionPosition, {
      offerId,
      name: "Pozycja po usunięciu szansy",
      widthMm: 2000,
      heightMm: 2000,
      priceNet: 5000,
      costNet: 3000,
    });
    expect(pos3Id).toBeDefined();
  });

  test("manages construction templates in settings catalog", async () => {
    const t = convexTest(schema);

    // Seed defaults
    const seedResult = await t.mutation(api.constructions.seedDefault, {});
    expect(seedResult.created).toBe(5);

    // List templates
    const list = await t.query(api.constructions.list, {});
    expect(list.length).toBe(5);
    expect(list[0].code).toBe("SZKLO-3T");
    const triangleLeft = list.find((c) => c.code === "TROJKAT-TARAS-L");
    expect(triangleLeft).toBeDefined();
    expect(triangleLeft?.name).toBe("Trójkąt do zabudowy tarasu LEWY");
    expect(triangleLeft?.defaultSystem).toBe("Profil H + Krokiew");

    const triangleRight = list.find((c) => c.code === "TROJKAT-TARAS-P");
    expect(triangleRight).toBeDefined();
    expect(triangleRight?.name).toBe("Trójkąt do zabudowy tarasu PRAWY");
    expect(triangleRight?.defaultSystem).toBe("Profil H + Krokiew");

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
    expect(updatedList.length).toBe(6);

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

    // Verify optional defaultPanesCount can be cleared with null
    await t.mutation(api.constructions.update, {
      id: newId,
      defaultPanesCount: null,
    });
    item = await t.query(api.constructions.get, { id: newId });
    expect(item?.defaultPanesCount).toBeUndefined();

    // Create construction without defaultPanesCount
    const fixId = await t.mutation(api.constructions.create, {
      name: "Ściana stała FIX",
      code: "FIX-1",
      defaultWidthMm: 1200,
      defaultHeightMm: 2300,
      materialCostNet: 2500,
      materialMarkupType: "percent",
      materialMarkupValue: 30,
      materialPriceNet: 3250,
      installationUnit: "m2",
      installationUnitRate: 150,
      installationCostNet: 800,
      installationMarkupType: "amount",
      installationMarkupValue: 400,
      installationPriceNet: 1200,
      defaultPriceNet: 4450,
    });
    const fixItem = await t.query(api.constructions.get, { id: fixId });
    expect(fixItem?.defaultPanesCount).toBeUndefined();
    expect(fixItem?.materialCostNet).toBe(2500);
    expect(fixItem?.materialMarkupType).toBe("percent");
    expect(fixItem?.materialMarkupValue).toBe(30);
    expect(fixItem?.materialPriceNet).toBe(3250);
    expect(fixItem?.installationUnit).toBe("m2");
    expect(fixItem?.installationUnitRate).toBe(150);
    expect(fixItem?.installationCostNet).toBe(800);
    expect(fixItem?.installationMarkupType).toBe("amount");
    expect(fixItem?.installationMarkupValue).toBe(400);
    expect(fixItem?.installationPriceNet).toBe(1200);
    expect(fixItem?.defaultPriceNet).toBe(4450);

    // Update pricing fields
    await t.mutation(api.constructions.update, {
      id: fixId,
      installationUnit: "mb",
      installationUnitRate: 200,
      materialCostNet: 3000,
      materialMarkupValue: 25,
      materialPriceNet: 3750,
      installationPriceNet: 1500,
    });
    const updatedFix = await t.query(api.constructions.get, { id: fixId });
    expect(updatedFix?.installationUnit).toBe("mb");
    expect(updatedFix?.installationUnitRate).toBe(200);
    expect(updatedFix?.materialCostNet).toBe(3000);
    expect(updatedFix?.materialMarkupValue).toBe(25);
    expect(updatedFix?.materialPriceNet).toBe(3750);
    expect(updatedFix?.installationPriceNet).toBe(1500);
    expect(updatedFix?.defaultPriceNet).toBe(5250);
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

    // 7. Reorder positions (zamiana kolejności pozycji)
    await t.mutation(api.offers.reorderConstructionPositions, {
      offerId,
      itemIds: [triangleId, baseDoorId],
    });

    offerData = await t.query(api.offers.getOfferWithItems, { offerId });
    expect(offerData!.items[0]._id).toBe(triangleId);
    expect(offerData!.items[0].positionIndex).toBe(1);
    expect(offerData!.items[1]._id).toBe(baseDoorId);
    expect(offerData!.items[1].positionIndex).toBe(2);
  });

  test("manages multiple offers and variants for a single sales opportunity", async () => {
    const t = convexTest(schema);

    // 1. Utwórz szansę sprzedaży
    const oppId = await t.run(async (ctx) => {
      return await ctx.db.insert("pendingJotformSubmissions", {
        submissionId: "SUB-MULTI",
        firstName: "Anna",
        lastName: "Nowak",
        processed: false,
        stage: "lead",
      });
    });

    // 2. Utwórz pierwszą ofertę (Wariant 1)
    const offer1Id = await t.mutation(api.offers.getOrCreateForOpportunity, {
      opportunityId: oppId,
    });
    expect(offer1Id).toBeDefined();

    await t.mutation(api.offers.addConstructionPosition, {
      offerId: offer1Id,
      name: "Pergola 4x3",
      widthMm: 4000,
      heightMm: 2500,
      priceNet: 20000,
      costNet: 14000,
    });

    // 3. Utwórz drugą ofertę (Wariant 2) dla tej samej szansy przez createOfferForOpportunity
    const offer2Id = await t.mutation(api.offers.createOfferForOpportunity, {
      opportunityId: oppId,
    });
    expect(offer2Id).toBeDefined();
    expect(offer2Id).not.toBe(offer1Id);

    const offer2Data = await t.query(api.offers.getOfferWithItems, { offerId: offer2Id });
    expect(offer2Data?.offer.title).toContain("Wariant 2");

    // 4. Skopiuj pierwszą ofertę jako Wariant 3 przez duplicateOffer
    const offer3Id = await t.mutation(api.offers.duplicateOffer, {
      offerId: offer1Id,
    });
    expect(offer3Id).toBeDefined();
    const offer3Data = await t.query(api.offers.getOfferWithItems, { offerId: offer3Id });
    expect(offer3Data?.items.length).toBe(1);
    expect(offer3Data?.items[0].name).toBe("Pergola 4x3");

    // 5. Pobierz listę wszystkich ofert dla tej szansy
    const allOppOffers = await t.query(api.offers.listByOpportunity, { opportunityId: oppId });
    expect(allOppOffers.length).toBe(3);
  });

  test("verifies OFFER_SLIDES_TEMPLATE_ID and CAD SVG renderer", async () => {
    const { OFFER_SLIDES_TEMPLATE_ID } = await import("../googleDrive");
    expect(OFFER_SLIDES_TEMPLATE_ID).toBe("1-gl0q_8B9k6eM0mWwh30tAbx9LN8sfhmwrHMRI-ppUg");

    const { renderCadConstructionSvg } = await import(
      "../../components/cad-configurator/cadSvgRenderer"
    );

    const sampleItem = {
      _id: "test_1",
      positionIndex: 1,
      name: "Ściana przesuwna szklana",
      widthMm: 3200,
      heightMm: 2400,
      panesCount: 4,
      fillType: "HART 10",
      color: "RAL 7016MAT",
      quantity: 1,
    };

    const svg = renderCadConstructionSvg(sampleItem);
    expect(svg).toContain("<svg");
    expect(svg).toContain("B = 3200");
    expect(svg).toContain("H = 2400");
    expect(svg).toContain("HART 10");
    expect(svg).toContain("POZ. #1: ŚCIANA PRZESUWNA SZKLANA");
  });

  test("assigns Google Docs template to service and resolves it in offer", async () => {
    const { DEFAULT_OFFER_DOCS_TEMPLATE_ID, OFFER_DOCX_TEMPLATE_ID } = await import("../googleDrive");
    expect(DEFAULT_OFFER_DOCS_TEMPLATE_ID).toBe("1XJnz47VXgNXFrOagFj7JiFxcmesIFWQAkQXS7ckc-6Y");
    expect(OFFER_DOCX_TEMPLATE_ID).toBe(DEFAULT_OFFER_DOCS_TEMPLATE_ID);

    const t = convexTest(schema);

    // 1. Create a service with custom Google Docs template
    const customTemplateId = "1CustomGoogleDocIdForPergolas";
    const serviceId = await t.run(async (ctx) => {
      return await ctx.db.insert("services", {
        name: "Pergole bioklimatyczne",
        isActive: true,
        sortOrder: 1,
        createdBy: "admin@adk.pl",
        offerTemplateGoogleDriveId: customTemplateId,
        offerTemplateName: "Szablon wyceny pergoli",
      });
    });

    // 2. Create opportunity with that service
    const oppId = await t.run(async (ctx) => {
      return await ctx.db.insert("pendingJotformSubmissions", {
        submissionId: "SUB-PERGOLA",
        firstName: "Tomasz",
        lastName: "Nowak",
        services: ["Pergole bioklimatyczne"],
        processed: false,
        stage: "lead",
      });
    });

    // 3. Create offer for that opportunity
    const offerId = await t.mutation(api.offers.getOrCreateForOpportunity, {
      opportunityId: oppId,
    });

    // 4. Verify getOfferWithItems returns the matched service and template
    const offerData = await t.query(api.offers.getOfferWithItems, { offerId });
    expect(offerData).not.toBeNull();
    expect(offerData!.service).not.toBeNull();
    expect(offerData!.service!._id).toBe(serviceId);
    expect(offerData!.service!.offerTemplateGoogleDriveId).toBe(customTemplateId);
    expect(offerData!.service!.offerTemplateName).toBe("Szablon wyceny pergoli");

    // 5. Update offer with specific override template
    await t.mutation(api.offers.updateOffer, {
      offerId,
      templateFileId: "1OverrideTemplateDirectlyOnOffer",
    });

    const updatedData = await t.query(api.offers.getOfferWithItems, { offerId });
    expect(updatedData!.offer.templateFileId).toBe("1OverrideTemplateDirectlyOnOffer");
  });

  test("synchronizes offer positions with construction templates (material & installation split)", async () => {
    const t = convexTest(schema);

    // 1. Create a construction template SZKLO-2T-194 with material and installation prices
    const templateId = await t.mutation(api.constructions.create, {
      name: "SZKŁO 2-TOROWE 1940x2300",
      code: "SZKLO-2T-194",
      defaultWidthMm: 1940,
      defaultHeightMm: 2300,
      defaultPanesCount: 2,
      materialCostNet: 1400,
      materialPriceNet: 2100,
      installationCostNet: 400,
      installationPriceNet: 969,
      defaultPriceNet: 3069,
    });
    expect(templateId).toBeDefined();

    // 2. Create opportunity and offer
    const oppId = await t.run(async (ctx) => {
      return await ctx.db.insert("pendingJotformSubmissions", {
        submissionId: "SUB-SZKLO-SYNC",
        firstName: "Jan",
        lastName: "Kowalski",
        processed: false,
        stage: "lead",
      });
    });

    const offerId = await t.mutation(api.offers.getOrCreateForOpportunity, {
      opportunityId: oppId,
    });

    // 3. Add position as legacy un-split snapshot (only priceNet 3069, no materialPriceNet / installationPriceNet)
    const itemId = await t.run(async (ctx) => {
      return await ctx.db.insert("offerConstructions", {
        offerId,
        positionIndex: 1,
        constructionId: templateId,
        name: "SZKŁO 2-TOROWE 1940x2300",
        shortName: "SZKLO-2T-194",
        quantity: 1,
        widthMm: 1940,
        heightMm: 2300,
        panesCount: 2,
        priceNet: 3069,
        costNet: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // 4. Test query hydration: getOfferWithItems automatically enriches missing pillars from template
    const hydrated = await t.query(api.offers.getOfferWithItems, { offerId });
    expect(hydrated).not.toBeNull();
    const pos = hydrated!.items[0];
    expect(pos.materialPriceNet).toBe(2100);
    expect(pos.installationPriceNet).toBe(969);
    expect(pos.materialCostNet).toBe(1400);
    expect(pos.installationCostNet).toBe(400);

    // 5. Update template prices in settings
    await t.mutation(api.constructions.update, {
      id: templateId,
      materialCostNet: 1500,
      materialPriceNet: 2300,
      installationCostNet: 500,
      installationPriceNet: 1100,
    });

    // 6. Explicitly sync offer with templates
    const syncRes = await t.mutation(api.offers.syncOfferWithConstructionTemplates, {
      offerId,
    });
    expect(syncRes.updatedCount).toBe(1);

    // 7. Verify document was patched and offer totals recalculated
    const afterSync = await t.query(api.offers.getOfferWithItems, { offerId });
    const posAfter = afterSync!.items[0];
    expect(posAfter.materialPriceNet).toBe(2300);
    expect(posAfter.installationPriceNet).toBe(1100);
    expect(posAfter.priceNet).toBe(3400);
    expect(posAfter.costNet).toBe(2000);
    // 8. Update brushesCostNet and handlesCostNet on template and sync
    await t.mutation(api.constructions.update, {
      id: templateId,
      brushesCostNet: 65,
      handlesCostNet: 57,
    });
    const syncRes2 = await t.mutation(api.offers.syncOfferWithConstructionTemplates, {
      offerId,
    });
    expect(syncRes2.updatedCount).toBe(1);
    const afterSync2 = await t.query(api.offers.getOfferWithItems, { offerId });
    expect(afterSync2!.items[0].brushesCostNet).toBe(65);
    expect(afterSync2!.items[0].handlesCostNet).toBe(57);
  });
});
