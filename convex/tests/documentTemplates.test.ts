import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

describe("documentTemplates", () => {
  test("upsert creates a new template with all fields", async () => {
    const t = convexTest(schema);

    const templateId = await t.mutation(api.documentTemplates.upsert, {
      key: "pomiar",
      name: "Pomiar 2026/03",
      googleDriveFileId: "drive-file-123",
      fileNamePattern: "Pomiar_{{firstName}}_{{lastName}}_{{city}}",
      fieldMappings: [
        { placeholder: "{{imie}}", field: "firstName" },
        { placeholder: "{{nazwisko}}", field: "lastName" },
      ],
    });

    expect(templateId).toBeDefined();

    const template = await t.query(api.documentTemplates.getByKey, {
      key: "pomiar",
    });
    expect(template).not.toBeNull();
    expect(template!.key).toBe("pomiar");
    expect(template!.name).toBe("Pomiar 2026/03");
    expect(template!.googleDriveFileId).toBe("drive-file-123");
    expect(template!.fileNamePattern).toBe(
      "Pomiar_{{firstName}}_{{lastName}}_{{city}}",
    );
    expect(template!.fieldMappings).toHaveLength(2);
    expect(template!.version).toBe(1);
    expect(template!.isActive).toBe(true);
  });

  test("upsert updates an existing template (same key)", async () => {
    const t = convexTest(schema);

    await t.mutation(api.documentTemplates.upsert, {
      key: "umowa",
      name: "Umowa v1",
      fileNamePattern: "Umowa_{{lastName}}",
      fieldMappings: [{ placeholder: "{{nazwisko}}", field: "lastName" }],
    });

    await t.mutation(api.documentTemplates.upsert, {
      key: "umowa",
      name: "Umowa v2",
      fileNamePattern: "Umowa_{{firstName}}_{{lastName}}",
      fieldMappings: [
        { placeholder: "{{imie}}", field: "firstName" },
        { placeholder: "{{nazwisko}}", field: "lastName" },
      ],
    });

    const template = await t.query(api.documentTemplates.getByKey, {
      key: "umowa",
    });
    expect(template).not.toBeNull();
    expect(template!.name).toBe("Umowa v2");
    expect(template!.fileNamePattern).toBe("Umowa_{{firstName}}_{{lastName}}");
    expect(template!.fieldMappings).toHaveLength(2);
    expect(template!.version).toBe(2);
  });

  test("list returns all templates", async () => {
    const t = convexTest(schema);

    await t.mutation(api.documentTemplates.upsert, {
      key: "pomiar",
      name: "Pomiar",
      fileNamePattern: "Pomiar_{{lastName}}",
      fieldMappings: [],
    });
    await t.mutation(api.documentTemplates.upsert, {
      key: "umowa",
      name: "Umowa",
      fileNamePattern: "Umowa_{{lastName}}",
      fieldMappings: [],
    });
    await t.mutation(api.documentTemplates.upsert, {
      key: "gwarancja",
      name: "Gwarancja",
      fileNamePattern: "Gwarancja_{{lastName}}",
      fieldMappings: [],
    });

    const templates = await t.query(api.documentTemplates.list, {});
    expect(templates).toHaveLength(3);
  });

  test("getByKey returns template by key", async () => {
    const t = convexTest(schema);

    await t.mutation(api.documentTemplates.upsert, {
      key: "faktura",
      name: "Faktura",
      fileNamePattern: "Faktura_{{lastName}}",
      fieldMappings: [{ placeholder: "{{nazwisko}}", field: "lastName" }],
    });

    const template = await t.query(api.documentTemplates.getByKey, {
      key: "faktura",
    });
    expect(template).not.toBeNull();
    expect(template!.key).toBe("faktura");
    expect(template!.name).toBe("Faktura");
  });

  test("getByKey returns null for non-existent key", async () => {
    const t = convexTest(schema);

    const template = await t.query(api.documentTemplates.getByKey, {
      key: "nieistniejacy",
    });
    expect(template).toBeNull();
  });

  test("updateFieldMappings updates only mappings and bumps version", async () => {
    const t = convexTest(schema);

    const templateId = await t.mutation(api.documentTemplates.upsert, {
      key: "pomiar",
      name: "Pomiar",
      fileNamePattern: "Pomiar_{{lastName}}",
      fieldMappings: [{ placeholder: "{{nazwisko}}", field: "lastName" }],
    });

    await t.mutation(api.documentTemplates.updateFieldMappings, {
      templateId,
      fieldMappings: [
        { placeholder: "{{imie}}", field: "firstName" },
        { placeholder: "{{nazwisko}}", field: "lastName" },
        { placeholder: "{{miasto}}", field: "city" },
      ],
    });

    const template = await t.query(api.documentTemplates.getByKey, {
      key: "pomiar",
    });
    expect(template).not.toBeNull();
    expect(template!.name).toBe("Pomiar");
    expect(template!.fileNamePattern).toBe("Pomiar_{{lastName}}");
    expect(template!.fieldMappings).toHaveLength(3);
    expect(template!.version).toBe(2);
  });

  test("deleteTemplate removes template", async () => {
    const t = convexTest(schema);

    const templateId = await t.mutation(api.documentTemplates.upsert, {
      key: "reklamacja",
      name: "Reklamacja",
      fileNamePattern: "Reklamacja_{{lastName}}",
      fieldMappings: [],
    });

    await t.mutation(api.documentTemplates.deleteTemplate, { id: templateId });

    const template = await t.query(api.documentTemplates.getByKey, {
      key: "reklamacja",
    });
    expect(template).toBeNull();
  });

  test("template with empty fieldMappings is valid", async () => {
    const t = convexTest(schema);

    const templateId = await t.mutation(api.documentTemplates.upsert, {
      key: "empty_mappings",
      name: "Empty Mappings Template",
      fileNamePattern: "Doc_{{lastName}}",
      fieldMappings: [],
    });

    expect(templateId).toBeDefined();

    const template = await t.query(api.documentTemplates.getByKey, {
      key: "empty_mappings",
    });
    expect(template).not.toBeNull();
    expect(template!.fieldMappings).toEqual([]);
  });
});
