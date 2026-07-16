import { query } from "./_generated/server";

export const getPisarzakInfo = query({
  args: {},
  handler: async (ctx) => {
    const clients = await ctx.db
      .query("clients")
      .collect();
    const client = clients.find(c => c.lastName === "Pisarzak");

    const pendings = await ctx.db
      .query("pendingJotformSubmissions")
      .collect();
    const pending = pendings.find(p => p.lastName === "Pisarzak" || p.clientId === client?._id);

    const orders = await ctx.db
      .query("orders")
      .collect();
    const order = orders.find(o => o.clientId === client?._id);

    return { client, pending, order };
  }
});
