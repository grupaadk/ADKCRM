import { query } from "./_generated/server";

export const getDebugInfo = query({
  args: {},
  handler: async (ctx) => {
    const order = await ctx.db.get("k57fpamgj0j71386sfn7h4kpph8agd12" as any);
    const templates = await ctx.db.query("documentTemplates").collect();
    return {
      orderPlan: order?.invoicePlan,
      templates: templates.filter(t => t.key === "umowa").map(t => ({ id: t._id, name: t.name, isActive: t.isActive, hasFile: !!t.googleDriveFileId }))
    };
  }
});
