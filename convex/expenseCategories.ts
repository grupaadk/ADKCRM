import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";

// Pobranie wszystkich kategorii wydatków
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return [];
    return await ctx.db.query("expenseCategories").collect();
  },
});

// Tworzenie nowej kategorii wydatków
export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const categoryId = await ctx.db.insert("expenseCategories", {
      name: args.name.trim(),
    });
    return categoryId;
  },
});

// Usuwanie kategorii wydatków (i czyszczenie jej przypisań z wydatków)
export const remove = mutation({
  args: {
    categoryId: v.id("expenseCategories"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    // Usuwamy przypisania kategorii z wydatków
    const expenses = await ctx.db.query("fakturowniaExpensesCache").collect();
    for (const exp of expenses) {
      if (exp.categoryId === args.categoryId) {
        await ctx.db.patch(exp._id, {
          categoryId: undefined,
        });
      }
    }

    // Usuwamy samą kategorię
    await ctx.db.delete(args.categoryId);
  },
});
