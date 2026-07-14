import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getOrder = mutation({
  args: {},
  handler: async (ctx) => {
    const orders = await ctx.db.query("orders").collect();
    let count = 0;
    for (const o of orders) {
      if (o.installationStartDate !== undefined && o.installationStartDate < 420) {
        await ctx.db.patch(o._id, { installationStartDate: 480 });
        count++;
      }
    }
    return `Naprawiono ${count} rekordów.`;
  }
});
