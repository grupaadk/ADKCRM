import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const viewTypeValidator = v.literal("table");

const sortByValidator = v.object({
  field: v.string(),
  direction: v.union(v.literal("asc"), v.literal("desc")),
});

const filterValidator = v.object({
  field: v.string(),
  value: v.string(),
});

export const getForUser = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("viewConfig"),
      _creationTime: v.number(),
      userId: v.string(),
      viewType: viewTypeValidator,
      columns: v.array(v.string()),
      sortBy: sortByValidator,
      filters: v.optional(v.array(filterValidator)),
      groupBy: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;

    if (!userId) {
      return null;
    }

    return await ctx.db
      .query("viewConfig")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const save = mutation({
  args: {
    viewType: viewTypeValidator,
    columns: v.array(v.string()),
    sortBy: sortByValidator,
    filters: v.optional(v.array(filterValidator)),
    groupBy: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;

    if (!userId) {
      throw new Error("Brak autoryzacji");
    }

    const existing = await ctx.db
      .query("viewConfig")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        viewType: args.viewType,
        columns: args.columns,
        sortBy: args.sortBy,
        filters: args.filters,
        groupBy: args.groupBy,
      });
    } else {
      await ctx.db.insert("viewConfig", {
        userId,
        viewType: args.viewType,
        columns: args.columns,
        sortBy: args.sortBy,
        filters: args.filters,
        groupBy: args.groupBy,
      });
    }
    return null;
  },
});

export const updateViewType = mutation({
  args: {
    viewType: viewTypeValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;

    if (!userId) {
      throw new Error("Brak autoryzacji");
    }

    const existing = await ctx.db
      .query("viewConfig")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { viewType: args.viewType });
    } else {
      await ctx.db.insert("viewConfig", {
        userId,
        viewType: args.viewType,
        columns: [
          "lastName",
          "firstName",
          "city",
          "status",
          "phone",
          "email",
          "documents",
        ],
        sortBy: { field: "lastName", direction: "asc" as const },
      });
    }
    return null;
  },
});

export const updateColumns = mutation({
  args: {
    columns: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;

    if (!userId) {
      throw new Error("Brak autoryzacji");
    }

    const existing = await ctx.db
      .query("viewConfig")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { columns: args.columns });
    } else {
      await ctx.db.insert("viewConfig", {
        userId,
        viewType: "table",
        columns: args.columns,
        sortBy: { field: "lastName", direction: "asc" as const },
      });
    }
    return null;
  },
});

export const updateSort = mutation({
  args: {
    sortBy: sortByValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;

    if (!userId) {
      throw new Error("Brak autoryzacji");
    }

    const existing = await ctx.db
      .query("viewConfig")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { sortBy: args.sortBy });
    } else {
      await ctx.db.insert("viewConfig", {
        userId,
        viewType: "table",
        columns: [
          "lastName",
          "firstName",
          "city",
          "status",
          "phone",
          "email",
          "documents",
        ],
        sortBy: args.sortBy,
      });
    }
    return null;
  },
});

export const updateFilters = mutation({
  args: {
    filters: v.array(filterValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;

    if (!userId) {
      throw new Error("Brak autoryzacji");
    }

    const existing = await ctx.db
      .query("viewConfig")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { filters: args.filters });
    } else {
      await ctx.db.insert("viewConfig", {
        userId,
        viewType: "table",
        columns: [
          "lastName",
          "firstName",
          "city",
          "status",
          "phone",
          "email",
          "documents",
        ],
        sortBy: { field: "lastName", direction: "asc" as const },
        filters: args.filters,
      });
    }
    return null;
  },
});
