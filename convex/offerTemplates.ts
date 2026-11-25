import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Wyciąga ID pliku Google Drive z pełnego linku Google Docs / Slides / Drive
 * lub zwraca czyste ID jeśli użytkownik wkleił samo ID.
 */
export function extractGoogleDriveFileId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const docMatch = trimmed.match(/\/(?:document|presentation|spreadsheets|file)\/d\/([a-zA-Z0-9_-]+)/);
  if (docMatch?.[1]) return docMatch[1];
  const openMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch?.[1]) return openMatch[1];
  return trimmed;
}

/**
 * Pobiera wszystkie szablony ofert posortowane wg kolejności (order).
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("offerTemplates")
      .withIndex("by_order")
      .take(200);
  },
});

/**
 * Zwraca informację, ile unikalnych szablonów przypisanych wcześniej do usług
 * można jeszcze zaimportować do nowej tabeli offerTemplates.
 */
export const getLegacyServiceTemplatesCount = query({
  args: {},
  handler: async (ctx) => {
    const [services, existing] = await Promise.all([
      ctx.db.query("services").take(200),
      ctx.db.query("offerTemplates").withIndex("by_order").take(200),
    ]);

    const existingIds = new Set(existing.map((t) => t.googleDriveFileId));
    const uniqueLegacyIds = new Set<string>();
    for (const s of services) {
      const fileId = s.offerTemplateGoogleDriveId
        ? extractGoogleDriveFileId(s.offerTemplateGoogleDriveId)
        : "";
      if (fileId && !existingIds.has(fileId)) {
        uniqueLegacyIds.add(fileId);
      }
    }
    return uniqueLegacyIds.size;
  },
});

/**
 * Dodaje nowy szablon oferty.
 */
export const create = mutation({
  args: {
    name: v.string(),
    googleDriveFileId: v.string(),
    description: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    const fileId = extractGoogleDriveFileId(args.googleDriveFileId);
    if (!name) throw new Error("Nazwa szablonu jest wymagana.");
    if (!fileId) throw new Error("ID lub link do pliku Google Drive jest wymagany.");

    const existing = await ctx.db
      .query("offerTemplates")
      .withIndex("by_order")
      .take(200);

    const shouldBeDefault = Boolean(args.isDefault) || existing.length === 0;
    if (shouldBeDefault) {
      for (const tpl of existing) {
        if (tpl.isDefault) {
          await ctx.db.patch(tpl._id, { isDefault: false, updatedAt: Date.now() });
        }
      }
    }

    const maxOrder = existing.reduce((max, t) => Math.max(max, t.order), -1);
    const now = Date.now();

    return await ctx.db.insert("offerTemplates", {
      name,
      googleDriveFileId: fileId,
      description: args.description?.trim() || undefined,
      isDefault: shouldBeDefault,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Aktualizuje istniejący szablon oferty.
 */
export const update = mutation({
  args: {
    id: v.id("offerTemplates"),
    name: v.optional(v.string()),
    googleDriveFileId: v.optional(v.string()),
    description: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existingDoc = await ctx.db.get(args.id);
    if (!existingDoc) throw new Error("Szablon oferty nie został znaleziony.");

    const patch: {
      name?: string;
      googleDriveFileId?: string;
      description?: string;
      isDefault?: boolean;
      order?: number;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.name !== undefined) {
      const trimmed = args.name.trim();
      if (!trimmed) throw new Error("Nazwa szablonu nie może być pusta.");
      patch.name = trimmed;
    }
    if (args.googleDriveFileId !== undefined) {
      const fileId = extractGoogleDriveFileId(args.googleDriveFileId);
      if (!fileId) throw new Error("ID lub link do pliku Google Drive jest wymagany.");
      patch.googleDriveFileId = fileId;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    if (args.order !== undefined) {
      patch.order = args.order;
    }
    if (args.isDefault !== undefined) {
      patch.isDefault = args.isDefault;
      if (args.isDefault) {
        const all = await ctx.db
          .query("offerTemplates")
          .withIndex("by_order")
          .take(200);
        for (const tpl of all) {
          if (tpl._id !== args.id && tpl.isDefault) {
            await ctx.db.patch(tpl._id, { isDefault: false, updatedAt: Date.now() });
          }
        }
      }
    }

    await ctx.db.patch(args.id, patch);
  },
});

/**
 * Usuwa szablon oferty.
 */
export const remove = mutation({
  args: {
    id: v.id("offerTemplates"),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) return;
    await ctx.db.delete(args.id);
  },
});

/**
 * Idempotentnie importuje istniejące szablony przypisane wcześniej do usług (services)
 * do niezależnej tabeli offerTemplates.
 */
export const migrateFromServices = mutation({
  args: {},
  handler: async (ctx) => {
    const [services, existing] = await Promise.all([
      ctx.db.query("services").take(200),
      ctx.db.query("offerTemplates").withIndex("by_order").take(200),
    ]);

    const existingIds = new Set(existing.map((t) => t.googleDriveFileId));
    const hasDefault = existing.some((t) => t.isDefault);
    let nextOrder = existing.reduce((max, t) => Math.max(max, t.order), -1) + 1;
    let importedCount = 0;
    const now = Date.now();

    for (const service of services) {
      const fileId = service.offerTemplateGoogleDriveId
        ? extractGoogleDriveFileId(service.offerTemplateGoogleDriveId)
        : "";
      if (!fileId || existingIds.has(fileId)) continue;

      existingIds.add(fileId);
      const name =
        service.offerTemplateName?.trim() ||
        `Szablon — ${service.name}`;

      await ctx.db.insert("offerTemplates", {
        name,
        googleDriveFileId: fileId,
        description: `Zaimportowany z usługi: ${service.name}`,
        isDefault: !hasDefault && importedCount === 0,
        order: nextOrder++,
        createdAt: now,
        updatedAt: now,
      });
      importedCount++;
    }

    return { importedCount };
  },
});
