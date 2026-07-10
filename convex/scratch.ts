import { query } from "./_generated/server";

export const getOrder = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.get("k574thk6pka0v0yaeyvwachsd187jmef" as any);
  }
});
