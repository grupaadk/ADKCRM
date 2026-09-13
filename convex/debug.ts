import { query } from "./_generated/server";
import { v } from "convex/values";

export const debugComplaints = query({
  args: { search: v.string() },
  handler: async (ctx, args) => {
    const complaints = await ctx.db.query("complaints").collect();
    const clients = await ctx.db.query("clients").collect();
    const clientMap = new Map(clients.map(c => [c._id, c]));

    const matches = [];

    for (const c of complaints) {
      const client = clientMap.get(c.clientId);
      const clientName = client ? `${client.firstName || ""} ${client.lastName || ""}`.toLowerCase() : "";
      
      if (clientName.includes(args.search.toLowerCase()) || 
          (c.description || "").toLowerCase().includes(args.search.toLowerCase()) ||
          (c.clientDescription || "").toLowerCase().includes(args.search.toLowerCase())) {
        matches.push({
          id: c._id,
          clientName: clientName,
          status: c.status,
          desc: c.description
        });
      }
    }
    
    return matches;
  }
});
