import { query } from "./_generated/server";

export const getStatuses = query({
  handler: async (ctx) => {
    const config = await ctx.db.query("crmConfig").first();
    return {
      statuses: config?.statuses,
      statusLabels: config?.statusLabels,
    };
  }
});
