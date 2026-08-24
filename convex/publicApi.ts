import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Publiczny endpoint zwracający listę aktywnych usług z widocznością na WWW (bez auth).
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

/**
 * Publiczny endpoint generujący URL do wgrania pliku w Convex Storage (bez auth).
 * POST /api/public/generate-upload-url
 */
export const publicGenerateUploadUrl = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  const uploadUrl = await ctx.runMutation(api.storage.generateUploadUrl);
  return new Response(JSON.stringify({ uploadUrl }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});

export const publicGenerateUploadUrlOptions = httpAction(async () => {
  return new Response(null, { status: 200, headers: corsHeaders });
});
