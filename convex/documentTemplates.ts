import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getByKey = query({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documentTemplates")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
  },
});

export const getById = query({
  args: {
    id: v.id("documentTemplates"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const templates = await ctx.db.query("documentTemplates").collect();
    return templates.sort((a, b) => {
      const keyCmp = a.key.localeCompare(b.key);
      return keyCmp !== 0 ? keyCmp : a.name.localeCompare(b.name);
    });
  },
});

export const listByKey = query({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const templates = await ctx.db
      .query("documentTemplates")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .collect();
    return templates.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const create = mutation({
  args: {
    key: v.string(),
    name: v.string(),
    googleDriveFileId: v.optional(v.string()),
    fileNamePattern: v.string(),
    fieldMappings: v.array(
      v.object({
        placeholder: v.string(),
        field: v.string(),
      }),
    ),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("documentTemplates", {
      key: args.key,
      name: args.name,
      googleDriveFileId: args.googleDriveFileId,
      fileNamePattern: args.fileNamePattern,
      fieldMappings: args.fieldMappings,
      version: 1,
      isActive: args.isActive ?? true,
    });
  },
});

export const updateById = mutation({
  args: {
    id: v.id("documentTemplates"),
    key: v.optional(v.string()),
    name: v.string(),
    googleDriveFileId: v.optional(v.string()),
    fileNamePattern: v.string(),
    fieldMappings: v.array(
      v.object({
        placeholder: v.string(),
        field: v.string(),
      }),
    ),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Szablon nie istnieje");
    await ctx.db.patch(args.id, {
      ...(args.key !== undefined && args.key !== existing.key ? { key: args.key } : {}),
      name: args.name,
      googleDriveFileId: args.googleDriveFileId,
      fileNamePattern: args.fileNamePattern,
      fieldMappings: args.fieldMappings,
      version: existing.version + 1,
      isActive: args.isActive ?? existing.isActive,
    });
    return args.id;
  },
});

export const upsert = mutation({
  args: {
    key: v.string(),
    name: v.string(),
    googleDriveFileId: v.optional(v.string()),
    fileNamePattern: v.string(),
    fieldMappings: v.array(
      v.object({
        placeholder: v.string(),
        field: v.string(),
      }),
    ),
    version: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("documentTemplates")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        googleDriveFileId: args.googleDriveFileId,
        fileNamePattern: args.fileNamePattern,
        fieldMappings: args.fieldMappings,
        version: args.version ?? existing.version + 1,
        isActive: args.isActive ?? existing.isActive,
      });
      return existing._id;
    }

    return await ctx.db.insert("documentTemplates", {
      key: args.key,
      name: args.name,
      googleDriveFileId: args.googleDriveFileId,
      fileNamePattern: args.fileNamePattern,
      fieldMappings: args.fieldMappings,
      version: args.version ?? 1,
      isActive: args.isActive ?? true,
    });
  },
});

export const updateFieldMappings = mutation({
  args: {
    templateId: v.id("documentTemplates"),
    fieldMappings: v.array(
      v.object({
        placeholder: v.string(),
        field: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new Error("Szablon nie istnieje");
    }
    await ctx.db.patch(args.templateId, {
      fieldMappings: args.fieldMappings,
      version: template.version + 1,
    });
    return args.templateId;
  },
});

export const deleteTemplate = mutation({
  args: {
    id: v.id("documentTemplates"),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.id);
    if (!template) {
      throw new Error("Szablon nie istnieje");
    }
    await ctx.db.delete(args.id);
  },
});
