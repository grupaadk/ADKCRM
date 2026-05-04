import { v } from "convex/values";
import { query, internalQuery, internalMutation } from "./_generated/server";

export const listByOrder = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("orderAttachments")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .order("desc")
      .collect();
  },
});

export const getById = internalQuery({
  args: { attachmentId: v.id("orderAttachments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.attachmentId);
  },
});

export const add = internalMutation({
  args: {
    orderId: v.id("orders"),
    fileId: v.string(),
    name: v.string(),
    url: v.string(),
    mimeType: v.optional(v.string()),
    size: v.optional(v.number()),
    folderPath: v.optional(v.string()),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("orderAttachments", {
      orderId: args.orderId,
      fileId: args.fileId,
      name: args.name,
      url: args.url,
      mimeType: args.mimeType,
      size: args.size,
      folderPath: args.folderPath,
      uploadedAt: Date.now(),
      uploadedBy: args.uploadedBy,
    });
  },
});

export const removeById = internalMutation({
  args: { attachmentId: v.id("orderAttachments") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.attachmentId);
  },
});

export const setAttachmentsFolderId = internalMutation({
  args: {
    orderId: v.id("orders"),
    folderId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, { attachmentsFolderId: args.folderId });
  },
});
