import { query } from "./_generated/server";

export const getExpenses = query({
  args: {},
  handler: async (ctx) => {
    const expenses = await ctx.db
      .query("fakturowniaExpensesCache")
      .withIndex("by_order", (q) => q.eq("orderId", "k57fpamgj0j71386sfn7h4kpph8agd12" as any))
      .collect();
    return expenses.map(e => ({
      number: e.number,
      kind: e.kind,
      net: e.netAmount,
      gross: e.grossAmount,
    }));
  }
});
