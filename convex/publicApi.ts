import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Publiczny endpoint zwracający listę aktywnych usług (bez auth).
 * GET /api/public/services
 */
export const publicServices = httpAction(async (ctx) => {
  const services = await ctx.runQuery(api.services.listActive);
  return new Response(JSON.stringify(services), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});

export const publicServicesOptions = httpAction(async () => {
  return new Response(null, { status: 200, headers: corsHeaders });
});
