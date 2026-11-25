import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../schema";
import { api } from "../_generated/api";
import { extractGoogleDriveFileId } from "../offerTemplates";

describe("Offer Templates Module", () => {
  test("extractGoogleDriveFileId extracts ID from Docs, Slides, Drive links and raw IDs", () => {
    expect(
      extractGoogleDriveFileId("https://docs.google.com/document/d/1AbC_dEf-12345/edit?usp=sharing"),
    ).toBe("1AbC_dEf-12345");
    expect(
      extractGoogleDriveFileId("https://docs.google.com/presentation/d/9XyZ_001/edit#slide=id.p"),
    ).toBe("9XyZ_001");
    expect(
      extractGoogleDriveFileId("https://drive.google.com/open?id=fileId_777"),
    ).toBe("fileId_777");
    expect(extractGoogleDriveFileId("raw_drive_id_999")).toBe("raw_drive_id_999");
  });

  test("creates, lists, updates, enforces single default, and removes offer templates", async () => {
    const t = convexTest(schema);

    const id1 = await t.mutation(api.offerTemplates.create, {
      name: "Szablon Zabudowa Tarasu",
      googleDriveFileId: "https://docs.google.com/document/d/doc_tpl_1/edit",
      description: "Podstawowy szablon tarasowy",
    });

    const id2 = await t.mutation(api.offerTemplates.create, {
      name: "Szablon Ogród Letni",
      googleDriveFileId: "doc_tpl_2",
      isDefault: true,
    });

    const list1 = await t.query(api.offerTemplates.list, {});
    expect(list1).toHaveLength(2);
    expect(list1[0].googleDriveFileId).toBe("doc_tpl_1");
    expect(list1[0].isDefault).toBe(false);
    expect(list1[1].googleDriveFileId).toBe("doc_tpl_2");
    expect(list1[1].isDefault).toBe(true);

    // Switching default back to id1 clears id2
    await t.mutation(api.offerTemplates.update, {
      id: id1,
      name: "Szablon Zabudowa Tarasu v2",
      isDefault: true,
    });

    const list2 = await t.query(api.offerTemplates.list, {});
    expect(list2.find((x) => x._id === id1)?.name).toBe("Szablon Zabudowa Tarasu v2");
    expect(list2.find((x) => x._id === id1)?.isDefault).toBe(true);
    expect(list2.find((x) => x._id === id2)?.isDefault).toBe(false);

    await t.mutation(api.offerTemplates.remove, { id: id2 });
    const list3 = await t.query(api.offerTemplates.list, {});
    expect(list3).toHaveLength(1);
    expect(list3[0]._id).toBe(id1);
  });

  test("migrates legacy service offer templates idempotently", async () => {
    const t = convexTest(schema);

    await t.run(async (ctx) => {
      await ctx.db.insert("services", {
        name: "Zabudowa tarasu",
        isActive: true,
        sortOrder: 0,
        createdBy: "test-user",
        offerTemplateGoogleDriveId: "legacy_doc_1",
        offerTemplateName: "Oferta Taras",
      });
      await ctx.db.insert("services", {
        name: "Ogród letni",
        isActive: true,
        sortOrder: 1,
        createdBy: "test-user",
        offerTemplateGoogleDriveId: "legacy_doc_1", // duplicate fileId
        offerTemplateName: "Duplikat",
      });
      await ctx.db.insert("services", {
        name: "Okna PCV",
        isActive: true,
        sortOrder: 2,
        createdBy: "test-user",
        offerTemplateGoogleDriveId: "legacy_doc_2",
      });
    });

    const beforeCount = await t.query(api.offerTemplates.getLegacyServiceTemplatesCount, {});
    expect(beforeCount).toBe(2);

    const res1 = await t.mutation(api.offerTemplates.migrateFromServices, {});
    expect(res1.importedCount).toBe(2);

    const afterCount = await t.query(api.offerTemplates.getLegacyServiceTemplatesCount, {});
    expect(afterCount).toBe(0);

    // Re-running migration is idempotent
    const res2 = await t.mutation(api.offerTemplates.migrateFromServices, {});
    expect(res2.importedCount).toBe(0);

    const templates = await t.query(api.offerTemplates.list, {});
    expect(templates).toHaveLength(2);
    expect(templates[0].name).toBe("Oferta Taras");
    expect(templates[0].isDefault).toBe(true);
    expect(templates[1].name).toBe("Szablon — Okna PCV");
    expect(templates[1].isDefault).toBe(false);
  });
});
